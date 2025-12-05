import React from "react";
import BrandingSidebar from "./BrandingSidebar";
import LoginForm from "./LoginForm";

const LoginPage: React.FC = () => {
  return (
    <main className="flex relative w-full h-screen">
      <BrandingSidebar />
      <LoginForm />
    </main>
  );
};

export default LoginPage;
