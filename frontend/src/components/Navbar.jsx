// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-indigo-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold">
              🎬 MovieReserve
            </Link>
            <div className="ml-10 flex space-x-4">
              <Link to="/" className="px-3 py-2 rounded-md hover:bg-indigo-700">
                Movies
              </Link>
              {user && (
                <Link
                  to="/my-reservations"
                  className="px-3 py-2 rounded-md hover:bg-indigo-700"
                >
                  My Reservations
                </Link>
              )}
              {user && user.role === "admin" && (
                <Link
                  to="/admin"
                  className="px-3 py-2 rounded-md hover:bg-indigo-700"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm">
                  {user.full_name} {user.role === "admin" && "(Admin)"}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-indigo-700 rounded-md hover:bg-indigo-800"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 hover:bg-indigo-700 rounded-md"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 bg-indigo-700 rounded-md hover:bg-indigo-800"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
