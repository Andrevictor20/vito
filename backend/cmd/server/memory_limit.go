package main

import (
	"log"
	"os"
	"runtime/debug"
	"strconv"
	"strings"
)

// applyMemoryLimit define o teto de heap do Go.
//
// O Raspberry Pi 4 (8 GB) hospeda o backend, a Evolution API (Node) e o PostgreSQL
// (256M) no mesmo host. Sem teto, o GC do Go deixa a heap crescer e o kernel passa
// a matar o PostgreSQL — a vítima mais frágil do box. GOMEMLIMIT (Go 1.19+) faz o
// coletor trabalhar mais perto do limite em vez de deixar a memória crescer.
func applyMemoryLimit() {
	raw := strings.TrimSpace(os.Getenv("GOMEMLIMIT"))
	if raw == "" {
		raw = "256MiB"
	}
	limit, err := parseMemoryLimit(raw)
	if err != nil || limit <= 0 {
		log.Printf("⚠️ [Vito Server] GOMEMLIMIT inválido (%q); usando o padrão de 256MiB", raw)
		limit = 256 << 20
	}
	debug.SetMemoryLimit(limit)
	log.Printf("🧠 [Vito Server] Teto de heap do Go definido: %s (%.0f MB)", raw, float64(limit)/(1024*1024))
}

// parseMemoryLimit converte "256MiB" / "512M" / "1GiB" em bytes.
func parseMemoryLimit(raw string) (int64, error) {
	cleaned := strings.TrimSpace(strings.ToUpper(raw))
	multiplier := int64(1)
	switch {
	case strings.HasSuffix(cleaned, "MIB"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "MIB")
	case strings.HasSuffix(cleaned, "GIB"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "GIB")
	case strings.HasSuffix(cleaned, "MB"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "MB")
	case strings.HasSuffix(cleaned, "GB"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "GB")
	case strings.HasSuffix(cleaned, "M"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "M")
	case strings.HasSuffix(cleaned, "G"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "G")
	}
	value, err := strconv.ParseFloat(strings.TrimSpace(cleaned), 64)
	if err != nil {
		return 0, err
	}
	return int64(value * float64(multiplier)), nil
}
