import { CloseIcon } from './icon';

const Drawer = () => {
  return null;
};

const Wrapper = ({ children }) => {
  return <div className="relative">{children}</div>;
};

const Content = ({ title, children, drawerRef, close, className }) => {
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

      <div
        className={`bg-base-100 fixed top-0 right-0 z-50 h-full min-w-[24rem] translate-x-full transform shadow-lg transition-transform peer-checked:translate-x-0 ${className}`}
      >
        <div className="flex h-screen flex-col">
          <div className="border-base-200 !bg-base-100 mb-3 flex place-content-between place-items-center border-b p-6 pb-3">
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
