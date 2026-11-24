package handler

import (
	"net/http"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

func respondError(w http.ResponseWriter, err error) {
	middleware.RespondError(w, err)
}
