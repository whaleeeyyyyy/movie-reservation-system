// src/pages/Movies.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const Movies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState("");

  const fetchMovies = useCallback(async () => {
    try {
      const params = selectedGenre ? { genre: selectedGenre } : {};
      const response = await axios.get("http://localhost:8000/api/movies", {
        params,
      });
      setMovies(response.data);
    } catch (error) {
      console.error("Error fetching movies:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedGenre]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const genres = [
    "Action",
    "Comedy",
    "Drama",
    "Horror",
    "Romance",
    "Sci-Fi",
    "Thriller",
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Now Showing</h1>

      <div className="mb-6">
        <label className="mr-2 font-semibold">Filter by Genre:</label>
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md"
        >
          <option value="">All Genres</option>
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {movies.map((movie) => (
          <Link key={movie.id} to={`/movies/${movie.id}`}>
            <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
              <div className="h-80 bg-gray-200 flex items-center justify-center">
                {movie.poster_image ? (
                  <img
                    src={movie.poster_image}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-6xl">🎬</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold truncate">
                  {movie.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {movie.genre} • {movie.duration_minutes} min
                </p>
                <p className="text-sm text-gray-600">{movie.rating}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {movies.length === 0 && (
        <div className="text-center text-gray-500 mt-10">No movies found</div>
      )}
    </div>
  );
};

export default Movies;
