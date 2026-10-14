package handler

import "strconv"

// parsePositiveInt interpreta limit/offset; default quando vazio, erro quando inválido.
func parsePositiveInt(raw string, def int) (int, error) {
	if raw == "" {
		return def, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return def, err
	}
	return n, nil
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
