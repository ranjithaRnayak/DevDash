// JavaScript source code
// src/api/apiClient.js
import axios from "axios";

const token = import.meta.env.VITE_AZDO_PAT;

const api = axios.create({
    baseURL: "https://se-tfs.visualstudio.com/PowerOperation/_apis",
    headers: {
        Authorization: `Basic ${btoa(':' + token)}`
  }
});

export default api;