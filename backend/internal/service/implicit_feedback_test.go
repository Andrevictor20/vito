package service

import (
	"testing"
	"time"
)

func TestBuildCorrectionInsight(t *testing.T) {
	now := time.Now().UTC()
	created := now.Add(-5 * time.Minute)
	if got := BuildCorrectionInsight("tarefa", "Comprar cafe", "Comprar café especial", created, now); got == "" {
		t.Fatal("correção rápida deveria gerar insight")
	}
	if got := BuildCorrectionInsight("tarefa", "Igual", "Igual", created, now); got != "" {
		t.Fatal("igual não deveria gerar insight")
	}
	old := now.Add(-2 * time.Hour)
	if got := BuildCorrectionInsight("tarefa", "A", "B", old, now); got != "" {
		t.Fatal("correção tardia não deveria gerar insight")
	}
}
