// src/pages/MyReservations.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

const MyReservations = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      const response = await axios.get(
        "http://localhost:8000/api/reservations"
      );
      setReservations(response.data);
    } catch (error) {
      console.error("Error fetching reservations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (reservationId) => {
    if (!window.confirm("Are you sure you want to cancel this reservation?")) {
      return;
    }

    try {
      await axios.delete(
        `http://localhost:8000/api/reservations/${reservationId}`
      );
      alert("Reservation cancelled successfully");
      fetchReservations();
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to cancel reservation");
    }
  };

  const isUpcoming = (showDate, showTime) => {
    const showDateTime = new Date(`${showDate}T${showTime}`);
    return showDateTime > new Date();
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
      <h1 className="text-3xl font-bold mb-8">My Reservations</h1>

      {reservations.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">
          No reservations found
        </div>
      ) : (
        <div className="space-y-6">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">
                    {reservation.movie_title}
                  </h3>
                  <div className="text-gray-600 space-y-1">
                    <p>📍 {reservation.theater_name}</p>
                    <p>
                      📅{" "}
                      {new Date(reservation.show_date).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                    <p>
                      🕐{" "}
                      {new Date(
                        `2000-01-01T${reservation.show_time}`
                      ).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                    <p>
                      💺 Seats:{" "}
                      {reservation.seats
                        .map((s) => `${s.row_label}${s.seat_number}`)
                        .join(", ")}
                    </p>
                    <p className="font-semibold">
                      💵 Total: ${reservation.total_price.toFixed(2)}
                    </p>
                    <p className="text-sm">
                      🎫 Booking Ref: {reservation.booking_reference}
                    </p>
                  </div>
                </div>
                <div className="ml-4">
                  {reservation.status === "confirmed" ? (
                    <>
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-3">
                        Confirmed
                      </span>
                      {isUpcoming(
                        reservation.show_date,
                        reservation.show_time
                      ) && (
                        <button
                          onClick={() => handleCancel(reservation.id)}
                          className="block w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                      Cancelled
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyReservations;
