import React from 'react';
import { FaArrowRight } from 'react-icons/fa';
import { useSelector } from 'react-redux';

import logo from '../../assets/logo.png';
import { Input } from '../../components/ui';
import useAuth from '../../services/auth/hook';

const SigninScreen = () => {
  const FormState = useSelector(state => state?.Form);
  const { signin, loginResult } = useAuth();

  const [user, setUser] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = e => {
    e.preventDefault();

    const payload = {
      username: user,
      password: password,
    };

    signin(payload);
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="card card-side bg-base-100 p-4 shadow-sm">
        <figure>
          <img src={logo} alt="logo" className="mx-auto h-auto w-96" />
        </figure>
        <div className="card-body !min-w-96">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <Input
                id="username"
                label="Username"
                required
                error={FormState?.errors?.username}
                value={user}
                type="text"
                onChange={e => setUser(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <Input
                id="password"
                label="Password"
                required
                error={FormState?.errors?.password}
                value={password}
                type="password"
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div className="card-actions justify-end">
              <button className="btn btn-primary" type="submit" disabled={loginResult.isLoading}>
                Masuk
                {loginResult.isLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <FaArrowRight />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SigninScreen;
