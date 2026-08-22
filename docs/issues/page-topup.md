# Page Top-Up Baru + Pindah Cancel Topup dari Membership History

## Goal

1. Page **Top-Up** baru di sidebar — tabel semua `saldo_log` (top-up & bonus) lintas member dari `GET /saldo_logs`.
2. Tabel punya **action hapus** = cancel topup (pindah dari membership history).
3. Action cancel di membership history **dipindah** → history jadi read-only.

Status data preview di page = **online-only**.

---

## Keputusan (sudah diklarifikasi)

| Topik | Keputusan |
|-------|-----------|
| Action "hapus" | **Cancel topup** — mirror pola existing di `history.jsx`: modal → reason + PIN manager → `PUT /balance/topup/{id}/cancel` → status `cancelled`, bonus ikut cancelled, saldo direcalc. Bukan hard-delete |
| Filter status | **Ada** — dropdown di header Tools (default `completed`, opsional `cancelled`). Backend support `?status=completed\|cancelled` via param filter `useTable().filter('status', v)`. Urutan: Completed → Cancelled |
| Kolom cancel audit | `cancelled_reason`, `cancelled_by`, `cancelled_at` — tampil saat status `cancelled` (fallback `-`) |
| Scan Card | **Di Top-Up** — alur mirror membership: `NFCField` → `checkSaldo({card_id})` → modal `CardContent` (kartu + form topup kalau session aktif). Online-only |
| Special membership | **Ada** — di form topup (`CardContent`) ada pilihan "Special Membership". Ya → skip cek session aktif, `payment_type` opsional, `is_special_member: true` di payload. Tidak → wajib session aktif (seperti sekarang), payload `is_special_member: false` |
| Payload topup | `{ nominal, payment_type, is_special_member }` — backend sudah support (`topupRequest.Validate` + `Topup` usecase): special → session_id null, tanpa bonus, `reference_code='special_membership'`, no event; normal → flow existing |
| Scan card membership | **Tidak diubah** — tetap seperti sekarang (`CardContent` kartu + form topup kalau session aktif). Tidak ada `readOnly` |
| Isi tabel | **Top-up + bonus** (default endpoint `/saldo_logs`) |
| Kolom member | **`membership.name`** — rel `Membership` + `q.Relation("Membership")` sudah ditambah di backend `franq` (uncommitted, di repo `~/Workspaces/franq`) |
| Offline | **Online-only** — offline → empty state + action hapus disembunyikan (cancel emang online-only) |
| Scope backend | **Tidak disentuh** — endpoint list + cancel sudah ada |

---

## API Facts

- **Base URL**: `VITE_API_URL` = `https://api.onward.co.id/pos` (`.env`) → endpoint path **tanpa** prefix onboarding.
- **`GET /saldo_logs`** (franq, `backend/pos/src/handler/rest/balance/handler.go:95`):
  - Query: `page`, `limit`, `status` (`completed` default / `cancelled`).
  - Filter backend: `reference_type IN ('top-up','bonus')`, `brand_id` = session, sort `created_at DESC`.
  - Response: `{ success, message, data: [SaldoLog], meta: {page, page_size, total, total_pages, has_next, has_prev} }`.
  - `SaldoLog` fields: `id`, `membership_id`, `reference_id`, `reference_type`, `reference_code`, `payment_type`, `nominal`, `status`, `cancelled_reason/by/at`, `created_at`, **`membership`** (rel).
- **`POST /balance/{id}/topup`**: body `{ nominal, payment_type, is_special_member }` — sudah support di backend franq:
  - `is_special_member=false` (default): `payment_type` wajib (`cash|transfer`), active sales session wajib, bonus dihitung via gRPC, `session_id` terisi.
  - `is_special_member=true`: `session_id=null`, `payment_type` opsional, bonus skip, skip cek session, `reference_code='special_membership'`, event tidak di-publish.
- **`PUT /balance/topup/{id}/cancel`**: body `{ password, cancelled_reason }` (keduanya required). Validasi backend: role manager + PIN. Top-up + bonus → `cancelled`, saldo recalc.

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | **NEW** `src/pages/authorize/topup/_subrouter.js` | Route `/topup` |
| 2 | **NEW** `src/pages/authorize/topup/table.config.jsx` | Config tabel (kolom + action) |
| 3 | **NEW** `src/pages/authorize/topup/index.jsx` | Page (useTable + Tools + Render + Pagination) |
| 4 | **NEW** `src/pages/authorize/topup/cancel.modal.jsx` | Modal cancel (pindah dari history) |
| 5 | **NEW** `src/services/topup/action.js` | `topupApi` (getSaldoLogs, cancelTopup) |
| 6 | **NEW** `src/services/topup/hook.js` | `useTopup()` wrapper |
| 7 | `src/services/store.js` | Register `topupApi` (middleware + reducer + blacklist) |
| 8 | `src/pages/authorize/membership/history.jsx` | **Hapus** `CancelTopupModal` + `isCancellable` + `handleCancel` + tombol `LuTrash2` |
| 9 | `src/components/ui/layout.jsx` | Sidebar item **Top Up** (`MoneyIcon`) → `/topup` |
| 10 | `src/pages/authorize/membership/card.content.jsx` | Tambah toggle **special membership** (skip session, payment_type opsional, payload `is_special_member`) |

---

## Detail Implementasi

### 1. `src/services/topup/action.js` — API

Ikut pola `src/services/membership/action.js`:

```js
export const topupApi = createApi({
  reducerPath: 'topupApi',
  baseQuery,
  endpoints: builder => ({
    getSaldoLogs: builder.query({
      query: params => ({ url: '/saldo_logs', method: 'GET', params }),
    }),
    cancelTopup: builder.mutation({
      query: ({ id, payload }) => ({ url: `/balance/topup/${id}/cancel`, method: 'PUT', body: payload }),
    }),
  }),
});
export const { useLazyGetSaldoLogsQuery, useCancelTopupMutation } = topupApi;
```

### 2. `src/services/topup/hook.js` — wrapper

Ikut pola `useMembership` di `src/services/membership/hook.js`:
- `getLogs(params)` → `useLazyGetSaldoLogsQuery` (unwrap)
- `cancel({ id, payload })` → `useCancelTopupMutation` (unwrap, dispatch `$failure(err)` on error)
- Return `getLogsResult`, `cancelResult`

### 3. `src/services/store.js` — register

Ikut pola `memberApi`:
- `import { topupApi } from './topup/action';`
- Tambah `topupApi` ke `apiMiddleware[]`
- Tambah `topupApi` ke `persistConfig.blacklist`

### 4. `src/pages/authorize/topup/table.config.jsx` — config tabel

Ikut pola `src/pages/authorize/membership/table.config.jsx` (`createTableConfig` → spread `config` dari `services/table/const`):

```js
const createTableConfig = ({ onRemove }) => ({
  ...config,
  url: '/saldo_logs',
  columns: {
    created_at: { component: row => <div>{dateFormat(row?.created_at, 'DD/MM/YYYY HH:mm')}</div> },
    reference_type: {
      component: row => {
        const isBonus = row?.reference_type === 'bonus';
        return <span className={`badge ${isBonus ? 'badge-soft' : 'badge-primary'}`}>{isBonus ? 'Bonus' : 'Topup'}</span>;
      },
    },
    nominal: { component: row => <div>{currencyFormat(row?.nominal)}</div> },
    reference_code: { component: row => <div>{row?.reference_code || '-'}</div> },
    payment_type: { component: row => <div className="capitalize">{row?.payment_type || '-'}</div> },
    membership: { component: row => <div>{row?.membership?.name || '-'}</div> },
    status: {
      component: row => (
        <span className={`badge ${row?.status === 'cancelled' ? 'badge-error' : 'badge-success'}`}>
          {row?.status || 'completed'}
        </span>
      ),
    },
    cancelled_reason: { component: row => <div>{row?.cancelled_reason || '-'}</div> },
    cancelled_by: { component: row => <div>{row?.cancelled_by || '-'}</div> },
    cancelled_at: { component: row => <div>{row?.cancelled_at ? dateFormat(row?.cancelled_at, 'DD/MM/YYYY HH:mm') : '-'}</div> },
    action: {
      component: row => (
        <button className="btn btn-ghost btn-circle btn-xs !text-error" title="Cancel topup" onClick={() => onRemove(row)}>
          <TrashIcon />
        </button>
      ),
    },
  },
});
```

> Catatan: `column.component` dipanggil dengan `column.component(data)` di `table.jsx:Td` — value render ke kolom. Pastikan tiap component return elemen renderable.

### 5. `src/pages/authorize/topup/index.jsx` — page

```
const topupTable = useTable('topup_saldo_logs', createTableConfig({ onRemove }));
const { openModal, closeModal } = useModal();
const { getLogs } = useTopup();

const onRemove = log => {
  openModal(<CancelTopupModal log={log} onClose={closeModal} onRefetch={() => topupTable.boot()} />, 'w-md');
};

const STATUS_FILTERS = [
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const [status, setStatus] = React.useState('completed');

// status → filter config (onChange memicu refetch via onFilter)
const handleStatusChange = value => {
  setStatus(value);
  topupTable.filter('status', value === 'all' ? null : value);
};

// Scan card (mirror membership/index.jsx):
const { checkSaldo, checkResult } = useMembership(); // reuse dari membership hook
const openScan = result => {
  openModal(<NFCField onRead={handleRead} isOpen onClose={closeModal} result={result} />, 'w-md');
};

const handleRead = uid => {
  if (isOffline) return; // online-only
  checkSaldo({ card_id: uid });
};

// Online success → CardContent; error → re-open NFCField
React.useEffect(() => {
  if (checkResult?.isSuccess) {
    onScanSuccess(checkResult?.data?.data);
  } else if (checkResult?.isError) {
    openScan(checkResult);
  }
}, [checkResult]);

const onScanSuccess = data => {
  openModal(
    <>
      <Modal.Header onClose={() => { closeModal(); setData(null); }}>
        <div className="text-[16px] font-semibold tracking-wide">Membership Card</div>
      </Modal.Header>
      <Modal.Body full>
        <CardContent
          data={data}
          onClose={() => { closeModal(); setData(null); }}
          onRefresh={() => getMember()}
        />
      </Modal.Body>
    </>,
    'w-md'
  );
};

// render:
<TopupTable.Tools>
  <div className="flex h-full place-content-end place-items-center gap-2 px-4">
    <button
      className="btn bg-primary/15 text-primary rounded-none border-0 px-6"
      onClick={() => openScan(checkResult)}
    >
      <CardSearchIcon /> Scan Card
    </button>
    <select
      name="filter-status"
      value={status}
      onChange={e => handleStatusChange(e.target.value)}
      className="select select-sm select-bordered"
    >
      {STATUS_FILTERS.map(f => (
        <option key={f.value} value={f.value}>{f.label}</option>
      ))}
    </select>
  </div>
</TopupTable.Tools>
<TopupTable.Render />
<TopupTable.Pagination />
```

- Gunakan `useTable(name, config)` — dia handle fetch + params + cache offline + pagination + search. URL di config = `/saldo_logs`.
- **Scan Card** (mirror membership/index.jsx): tombol di header Tools → `NFCField` → `checkSaldo({card_id})` → sukses → modal `CardContent` (kartu visual + form topup kalau session aktif). Reuse `useMembership()` untuk checkSaldo/checkResult; `NFCField`, `CardContent`, `CardSearchIcon` dari `components/ui`. Online-only (offline → scan tidak di-trigger).
- **Filter status**: `useTable().filter('status', v)` → set filter config → `refetch()`. `buildParams` (di `table/action.js`) meneruskan `filter.status` → query `?status=...`. Default `completed`. Klik "Cancelled" → tampil log yang dibatalkan (+ kolom cancelled_* terisi).
- Loading/empty state sudah di-handle `TableRender` (lihat `table/table.jsx` EmptyData).
- Setelah cancel sukses → `topupTable.boot()` (refetch) — menggantikan `getLogs(params)` manual.

### 5b. `src/pages/authorize/membership/card.content.jsx` — special membership toggle

**Tidak ada `readOnly`** — scan card membership & topup-manual tetap normal (kartu + form topup kalau session aktif).

**Special membership toggle:**
- Tambah state `const [isSpecial, setIsSpecial] = React.useState(false)`.
- **Form Section** render kalau `hasSession || isSpecial` (bukan cuma `hasSession`).
- UI toggle di atas "Topup Amount": checkbox/switch **"Topup Special Membership"**.
  - Offline (`isOffline`) → toggle **disabled/tersembunyi** — offline sync tidak support special member (khusus REST online).
- **Validation**:
  - Normal (`isSpecial=false`): wajib `hasSession` + `sessionSummary`, `payment_type` wajib (behavior existing).
  - Special (`isSpecial=true`): tidak perlu session aktif; `payment_type` **opsional** (boleh kosong).
- **Payload topup** (`onTopupOnline`):
  ```js
  const payload = {
    nominal: parseFloat(nominal) || 0,
    payment_type: method, // boleh '' saat special
    is_special_member: isSpecial, // tambah field baru
  };
  topup({ id: data?.id, payload });
  ```
- **Tombol Top Up disabled logic**: `topupResult?.isLoading || (!isOffline && !sessionSummary && !isSpecial)` → special member tidak butuh sessionSummary.
- `onTopupOffline` → path offline tetap normal (isSpecial tidak dipakai / toggle disabled).
- Top-Up scan `CardContent` dipakai normal (tanpa readOnly) → form topup muncal kalau session aktif.

### 6. `src/pages/authorize/topup/cancel.modal.jsx` — modal cancel

Copy dari `src/pages/authorize/membership/history.jsx` `CancelTopupModal` (baris ~12–83), bedanya:
- Ganti `useMembership().cancelTopup` → `useTopup().cancel`
- `onSuccess` → `onRefetch()` (panggil `topupTable.boot()`)
- `membership` prop nggak dipakai lagi (tabel list, bukan per-member) → **hapus** dependencies `showMember`/`saldoLog` refresh per-member; cuma refetch list.

Struktur modal tetep: Header "Cancel Topup", Body (konfirmasi + Reason + PIN Input), Footer (Cancel / Confirm error-red).

### 7. `src/pages/authorize/membership/history.jsx` — hapus cancel

- Hapus `CancelTopupModal` (baris 12–83) → pindah ke `topup/cancel.modal.jsx`.
- Hapus `isCancellable()` (baris ~86–96), `handleCancel` (baris ~258–262).
- Hapus tombol trash di render log (baris ~333–337) + import `LuTrash2`.
- History jadi **read-only** list saldo log per member.

### 8. `src/pages/authorize/topup/_subrouter.js` — route

```js
import TopUpScreen from '.';
const routes = [{ path: '/topup', element: TopUpScreen }];
export default routes;
```

(`import.meta.glob` di `router.jsx` sudah auto-load `**/*_subrouter.js`.)

### 9. `src/components/ui/layout.jsx` — sidebar

Di `Navbar`, setelah item Member/History. **Hanya render saat online** (page online-only):

```jsx
{isOnline && (
  <div className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'topup')}`}
       onClick={() => navigate('/topup')}>
    <MoneyIcon />
    <small>Top Up</small>
  </div>
)}
```

- `isOnline` berasal dari `useSelector(state => state?.Offline?.isOnline) && apiReachable !== false` (pola sama kayak `isOffline` di halaman lain, tapi dibalik).
- `isActive(splitLocation[1], 'topup')` → highlight aktif saat di `/topup`.
- `MoneyIcon` sudah di-export `src/components/ui/icon/index.js`.
- **Offline → item Top Up hilang dari sidebar** (konsisten dengan page online-only).

---

## Online-only guard

Di page `index.jsx`:
```js
const isOffline = !isOnline || apiReachable === false;
// kalau isOffline → jangan fetch (biarkan useTable cache kosong / tampilkan empty state),
// dan onRemove tidak memanggil modal (atau modal disabled).
```

Mirror `isCancellable()` existing yang `if (isOffline) return false`.

---

## Reused (jangan buat baru)

- `useTable` / `Table.Render` / `Table.Tools` / `Table.Pagination` — `src/components/ui/table/`
- `createTableConfig` pattern — `src/pages/authorize/membership/table.config.jsx`
- `currencyFormat`, `dateFormat` — `src/utils/common.js`
- `useModal` / `<Modal.Header|Body|Footer>`, `<Input>` — `src/components/ui/`
- `config` default table state — `src/services/table/const.js`
- Ikon: `MoneyIcon`, `TrashIcon`

---

## Verification

1. **Build**: `npm run build` (atau `npm run build:sandbox`) — tanpa error.
2. **Manual**:
   - Sidebar muncul item **Top Up** → `/topup` render tabel.
   - Kolom: created_at, reference_type, nominal (currency), reference_code, payment_type, membership.name, status, action trash + cancelled_reason/by/at.
   - Tombol **Scan Card** di header → scan NFC → modal CardContent: kartu + form topup.
- Keber Screen: form topup punya toggle **Topup Special Membership** — aktif → tanpa session aktif, payment_type opsional; non-aktif → wajib session aktif + payment_type. Payload kirim `is_special_member`.
   - Membership scan card tetap normal (kartu + form topup) — **tidak diubah**.
   - Dropdown status: default Completed → switch ke Cancelled → list refresh pakai `?status=cancelled`, baris cancelled tampil.
   - Click trash → modal Cancel Topup (reason + PIN) → confirm → row `status=cancelled`, list refresh.
   - Error: role non-manager / PIN salah / reason kosong → error tampil.
   - Membership → see detail → history: tombol trash **hilang**, list masih jalan.

Satu hal yang perlu dipastikan: topup **special member** (is_special_member=true) → `payment_type` opsional, jadi kalau method kosong, payload `payment_type` biarkan kosong (`''` → backend entity nullable). Dan hasil special member muncul di tabel `/saldo_logs` dengan `membership.name` terisi (rel membership), tapi `payment_type` '-' dan `reference_code='special_membership'`. Pastikan kolom `reference_code` menampilkan `special_membership` (bukan label acak), dan kolom `payment_type` fallback `-` saat kosong — sudah di config.
3. **Offline**: network off → sidebar item **Top Up hilang**, `/topup` empty state, tombol hapus nggak muncul, nggak fetch.

---

## Out of scope

- Backend `franq` (rel membership dikerjain user; endpoint list/cancel sudah ada).
- Offline mode untuk `/saldo_logs` (online-only).