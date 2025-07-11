import { CloseIcon } from './icon';

const Drawer = () => {
  return null;
};

const Wrapper = ({ children }) => {
  return <div className="relative">{children}</div>;
};

const Content = ({ title, children, drawerRef, close }) => {
  return (
    <div>
      <input
        id="drawer"
        type="checkbox"
        ref={drawerRef}
        className="peer hidden"
        onChange={e => {
          if (!e.target.checked) close();
        }}
      />
      <label
        htmlFor="drawer"
        className="fixed inset-0 z-40 hidden bg-black/20 peer-checked:block"
      />

      <div className="fixed top-0 right-0 z-50 h-full min-w-[24rem] translate-x-full transform bg-white shadow-lg transition-transform peer-checked:translate-x-0">
        <div className="flex min-h-full flex-col p-6">
          <div className="border-secondary mb-3 flex place-content-between place-items-center border-b pb-3">
            <div className="text-[16px] font-semibold tracking-wide uppercase">{title}</div>
            <div className="btn btn-ghost btn-sm btn-circle" onClick={close}>
              <CloseIcon />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

Drawer.Wrapper = Wrapper;
Drawer.Content = Content;

export default Drawer;
