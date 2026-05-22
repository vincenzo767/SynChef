import axios from "axios";
const API_BASE_URL = "/api";

const authAPI = {
  register: (data) => axios.post(`${API_BASE_URL}/auth/register`, data),
  login: (data) => axios.post(`${API_BASE_URL}/auth/login`, data),
  googleLogin: (data) => axios.post(`${API_BASE_URL}/auth/google`, data),
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
};

export default authAPI;
