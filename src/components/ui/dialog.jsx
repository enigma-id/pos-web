import { CloseIcon } from './icon';

const Dialog = () => {
  return null;
};

const Wrapper = ({ className, ref, children }) => {
  return (
    <dialog ref={ref} className="modal">
      <div className={`bg-base-100 rounded ${className}`}>{children}</div>
    </dialog>
  );
};

const Header = ({ onClose, children }) => {
  return (
    <div className="border-base-200 relative w-full border-b px-4 py-6">
      {children}

      <div className="absolute top-3 right-3">
        <div className="btn btn-ghost btn-circle btn-md" onClick={onClose}>
          <CloseIcon />
        </div>
      </div>
    </div>
  );
};

const Body = ({ children }) => {
  return <div className="px-4">{children}</div>;
};

const Footer = ({ children }) => {
  return (
    <div className="border-secondary flex h-16 place-content-end place-items-center gap-4 border-t px-4">
      {children}
    </div>
  );
};

Dialog.Wrapper = Wrapper;
Dialog.Header = Header;
Dialog.Body = Body;
Dialog.Footer = Footer;

export default Dialog;
