import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const SeatSelection = () => {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [showtime, setShowtime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const fetchShowtimeAndSeats = useCallback(async () => {
    try {
      const [showtimeRes, seatsRes] = await Promise.all([
        axios.get("http://localhost:8000/api/showtimes", {
          params: { movie_id: null },
        }),
        axios.get(`http://localhost:8000/api/showtimes/${showtimeId}/seats`),
      ]);

      const currentShowtime = showtimeRes.data.find((s) => s.id === showtimeId);
      setShowtime(currentShowtime);
      setSeats(seatsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [showtimeId]);

  useEffect(() => {
    fetchShowtimeAndSeats();
  }, [fetchShowtimeAndSeats]);

  const handleSeatClick = (seat) => {
    if (!seat.is_available) return;

    if (selectedSeats.find((s) => s.id === seat.id)) {
      setSelectedSeats(selectedSeats.filter((s) => s.id !== seat.id));
    } else {
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const handleBooking = async () => {
    if (selectedSeats.length === 0) return;

    setBooking(true);
    try {
      await axios.post("http://localhost:8000/api/reservations", {
        showtime_id: showtimeId,
        seat_ids: selectedSeats.map((s) => s.id),
      });
      alert("Booking successful!");
      navigate("/my-reservations");
    } catch (error) {
      alert(
        error.response?.data?.detail || "Booking failed. Please try again."
      );
      fetchShowtimeAndSeats(); // Refresh seats
    } finally {
      setBooking(false);
    }
  };

  const getSeatColor = (seat) => {
    if (selectedSeats.find((s) => s.id === seat.id)) {
      return "bg-indigo-600 text-white";
    }
    if (!seat.is_available) {
      return "bg-gray-400 text-gray-200 cursor-not-allowed";
    }
    if (seat.seat_type === "vip") {
      return "bg-yellow-200 hover:bg-yellow-300";
    }
    if (seat.seat_type === "premium") {
      return "bg-blue-200 hover:bg-blue-300";
    }
    return "bg-green-200 hover:bg-green-300";
  };

  // Group seats by row
  const groupedSeats = seats.reduce((acc, seat) => {
    if (!acc[seat.row_label]) {
      acc[seat.row_label] = [];
    }
    acc[seat.row_label].push(seat);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {showtime && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{showtime.movie_title}</h1>
          <p className="text-gray-600">
            {showtime.theater_name} •{" "}
            {new Date(showtime.show_date).toLocaleDateString()} •{" "}
            {new Date(`2000-01-01T${showtime.show_time}`).toLocaleTimeString(
              "en-US",
              {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }
            )}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Screen */}
        <div className="mb-8">
          <div className="bg-gray-800 text-white text-center py-2 rounded-t-full mb-2">
            SCREEN
          </div>
          <div className="h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Seat Map */}
        <div className="flex flex-col items-center space-y-2 mb-8">
          {Object.keys(groupedSeats)
            .sort()
            .map((row) => (
              <div key={row} className="flex items-center space-x-2">
                <span className="w-8 text-center font-semibold text-gray-700">
                  {row}
                </span>
                {groupedSeats[row]
                  .sort((a, b) => a.seat_number - b.seat_number)
                  .map((seat) => (
                    <button
                      key={seat.id}
                      onClick={() => handleSeatClick(seat)}
                      disabled={!seat.is_available}
                      className={`w-10 h-10 rounded-t-lg flex items-center justify-center text-sm font-semibold transition-colors ${getSeatColor(
                        seat
                      )}`}
                      title={`${row}${seat.seat_number} - ${seat.seat_type}`}
                    >
                      {seat.seat_number}
                    </button>
                  ))}
              </div>
            ))}
        </div>

        {/* Legend */}
        <div className="flex justify-center space-x-6 mb-8 text-sm">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-green-200 rounded mr-2"></div>
            <span>Standard</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-6 bg-blue-200 rounded mr-2"></div>
            <span>Premium</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-6 bg-yellow-200 rounded mr-2"></div>
            <span>VIP</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-6 bg-indigo-600 rounded mr-2"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-6 bg-gray-400 rounded mr-2"></div>
            <span>Occupied</span>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-lg font-semibold">
                Selected Seats:{" "}
                {selectedSeats
                  .map((s) => `${s.row_label}${s.seat_number}`)
                  .join(", ") || "None"}
              </p>
              <p className="text-gray-600">
                Total: $
                {showtime
                  ? (showtime.price * selectedSeats.length).toFixed(2)
                  : "0.00"}
              </p>
            </div>
            <button
              onClick={handleBooking}
              disabled={selectedSeats.length === 0 || booking}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {booking ? "Processing..." : "Book Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatSelection;
