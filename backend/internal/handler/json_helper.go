package handler

import (
	"net/http"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	middleware.WriteJSON(w, status, data)
}
