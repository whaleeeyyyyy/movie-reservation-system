import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const MovieDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMovie = useCallback(async () => {
    try {
      const response = await axios.get(
        `http://localhost:8000/api/movies/${id}`
      );
      setMovie(response.data);
    } catch (error) {
      console.error("Error fetching movie:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchShowtimes = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:8000/api/showtimes", {
        params: { movie_id: id, show_date: selectedDate },
      });
      setShowtimes(response.data);
    } catch (error) {
      console.error("Error fetching showtimes:", error);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    fetchMovie();
    // Set default date to today
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  }, [fetchMovie]);

  useEffect(() => {
    if (selectedDate) {
      fetchShowtimes();
    }
  }, [selectedDate, fetchShowtimes]);

  const handleShowtimeSelect = (showtimeId) => {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate(`/showtime/${showtimeId}/seats`);
  };

  // Generate next 7 days
  const getNext7Days = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (!movie) {
    return <div className="text-center mt-10">Movie not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-gray-200 h-96 flex items-center justify-center rounded-lg">
            {movie.poster_image ? (
              <img
                src={movie.poster_image}
                alt={movie.title}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <span className="text-9xl">🎬</span>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold mb-4">{movie.title}</h1>
          <div className="flex space-x-4 mb-4 text-gray-600">
            <span>{movie.genre}</span>
            <span>•</span>
            <span>{movie.duration_minutes} min</span>
            <span>•</span>
            <span>{movie.rating}</span>
          </div>
          <p className="text-gray-700 mb-8">{movie.description}</p>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4">Select Date</h2>
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {getNext7Days().map((date) => {
                const dateObj = new Date(date);
                const isSelected = date === selectedDate;
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    <div className="text-sm">
                      {dateObj.toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </div>
                    <div className="font-semibold">
                      {dateObj.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Available Showtimes</h2>
            {showtimes.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {showtimes.map((showtime) => (
                  <button
                    key={showtime.id}
                    onClick={() => handleShowtimeSelect(showtime.id)}
                    className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-600 hover:shadow-md transition-all"
                    disabled={showtime.available_seats === 0}
                  >
                    <div className="text-lg font-semibold">
                      {new Date(
                        `2000-01-01T${showtime.show_time}`
                      ).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {showtime.theater_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      ${showtime.price.toFixed(2)}
                    </div>
                    <div className="text-xs mt-2">
                      {showtime.available_seats > 0 ? (
                        <span className="text-green-600">
                          {showtime.available_seats} seats left
                        </span>
                      ) : (
                        <span className="text-red-600">Sold Out</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">
                No showtimes available for this date
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieDetails;
