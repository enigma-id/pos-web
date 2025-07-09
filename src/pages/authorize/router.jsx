import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout, SidebarProvider } from '../../components/ui';

const pages = import.meta.glob('./**/*_subrouter.js', { eager: true });

const routes = Object.values(pages).flatMap(mod => mod.default || []);

const AuthorizeRouter = () => {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <Layout>
          <Layout.Navbar />
          <Layout.Body>
            <Routes>
              {routes?.map((r, i) => (
                <Route key={i} path={r.path} element={<r.element />} />
              ))}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout.Body>
        </Layout>
      </SidebarProvider>
    </BrowserRouter>
  );
};

export default AuthorizeRouter;
