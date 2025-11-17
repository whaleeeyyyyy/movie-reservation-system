// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const AdminDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await axios.get(
        "http://localhost:8000/api/admin/reports/summary"
      );
      setSummary(response.data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Total Reservations
          </h3>
          <p className="text-3xl font-bold text-indigo-600">
            {summary?.total_reservations || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Total Revenue
          </h3>
          <p className="text-3xl font-bold text-green-600">
            ${(summary?.total_revenue || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Total Customers
          </h3>
          <p className="text-3xl font-bold text-blue-600">
            {summary?.total_customers || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-gray-500 text-sm font-semibold mb-2">
            Seats Booked
          </h3>
          <p className="text-3xl font-bold text-purple-600">
            {summary?.total_seats_booked || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/movies"
          className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow"
        >
          <div className="text-center">
            <div className="text-5xl mb-4">🎬</div>
            <h3 className="text-xl font-semibold mb-2">Manage Movies</h3>
            <p className="text-gray-600">Add, edit, or remove movies</p>
          </div>
        </Link>

        <Link
          to="/admin/showtimes"
          className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow"
        >
          <div className="text-center">
            <div className="text-5xl mb-4">🎫</div>
            <h3 className="text-xl font-semibold mb-2">Manage Showtimes</h3>
            <p className="text-gray-600">Schedule movie showtimes</p>
          </div>
        </Link>

        <Link
          to="/admin/reports"
          className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow"
        >
          <div className="text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">View Reports</h3>
            <p className="text-gray-600">Detailed reservation reports</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
