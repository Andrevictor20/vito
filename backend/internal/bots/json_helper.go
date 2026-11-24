package bots

import (
	"net/http"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	middleware.WriteJSON(w, status, data)
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	middleware.WriteJSONError(w, status, msg)
}

func respondError(w http.ResponseWriter, err error) {
	middleware.RespondError(w, err)
}
