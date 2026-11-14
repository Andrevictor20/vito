package service

import (
	"math"
	"testing"
	"time"
)

func d(y int, m time.Month, day int) time.Time {
	return time.Date(y, m, day, 12, 0, 0, 0, time.UTC)
}

func TestBuildInstallmentPlans_DeduplicaObservacoesDoMesmoPlano(t *testing.T) {
	obs := []InstallmentObservation{
		{AccountID: "a1", Merchant: "MAGALU *TV", Number: 2, Total: 10, Amount: 199.90, Date: d(2026, 10, 5)},
		{AccountID: "a1", Merchant: "magalu *tv ", Number: 3, Total: 10, Amount: 199.90, Date: d(2026, 11, 5)},
		{AccountID: "a1", Merchant: "Outra Loja", Number: 1, Total: 3, Amount: 50, Date: d(2026, 11, 2)},
	}
	plans := BuildInstallmentPlans(obs)
	if len(plans) != 2 {
		t.Fatalf("esperava 2 planos, obteve %d", len(plans))
	}
	for _, p := range plans {
		if p.Merchant == "magalu *tv" && p.LastNumber != 3 {
			t.Fatalf("LastNumber deveria ser 3, obteve %d", p.LastNumber)
		}
	}
}

func TestBuildInstallmentPlans_IgnoraAVistaEDadosInvalidos(t *testing.T) {
	obs := []InstallmentObservation{
		{AccountID: "a1", Merchant: "Padaria", Number: 1, Total: 1, Amount: 12, Date: d(2026, 11, 1)},
		{AccountID: "a1", Merchant: "Loja", Number: 0, Total: 5, Amount: 10, Date: d(2026, 11, 1)},
		{AccountID: "a1", Merchant: "Loja", Number: 6, Total: 5, Amount: 10, Date: d(2026, 11, 1)},
	}
	if got := BuildInstallmentPlans(obs); len(got) != 0 {
		t.Fatalf("esperava 0 planos, obteve %d", len(got))
	}
}

func TestProjectInstallments_ConservacaoDaSoma(t *testing.T) {
	plans := BuildInstallmentPlans([]InstallmentObservation{
		{AccountID: "a1", Merchant: "TV", Number: 3, Total: 10, Amount: 200, Date: d(2026, 11, 5)},
		{AccountID: "a2", Merchant: "Celular", Number: 1, Total: 4, Amount: 100, Date: d(2026, 11, 3)},
	})
	proj := ProjectInstallments(plans, d(2026, 11, 10), 12)
	var total float64
	for _, m := range proj.Months {
		total += m.Total
	}
	want := 7*200.0 + 3*100.0
	if math.Abs(total-want) > 0.001 {
		t.Fatalf("soma projetada %.2f != restante %.2f", total, want)
	}
	if math.Abs(proj.TotalCommitted-want) > 0.001 {
		t.Fatalf("TotalCommitted %.2f != %.2f", proj.TotalCommitted, want)
	}
}

func TestProjectInstallments_MesesECalendarioSemEstourarDia31(t *testing.T) {
	plans := BuildInstallmentPlans([]InstallmentObservation{
		{AccountID: "a1", Merchant: "Loja", Number: 1, Total: 3, Amount: 90, Date: d(2026, 1, 31)},
	})
	proj := ProjectInstallments(plans, d(2026, 1, 31), 3)
	if len(proj.Months) != 2 || proj.Months[0].Month != "2026-02" || proj.Months[1].Month != "2026-03" {
		t.Fatalf("meses inesperados: %+v", proj.Months)
	}
}

func TestProjectInstallments_ParcelasFuturasDoBancoSaoConfirmadas(t *testing.T) {
	plans := BuildInstallmentPlans([]InstallmentObservation{
		{AccountID: "a1", Merchant: "TV", Number: 2, Total: 4, Amount: 100, Date: d(2026, 11, 5)},
		{AccountID: "a1", Merchant: "TV", Number: 3, Total: 4, Amount: 100, Date: d(2026, 12, 5), Pending: true},
	})
	proj := ProjectInstallments(plans, d(2026, 11, 10), 6)
	var conf, projected int
	for _, m := range proj.Months {
		for _, e := range m.Entries {
			if e.Status == InstallmentConfirmed {
				conf++
			} else {
				projected++
			}
		}
	}
	if conf != 1 || projected != 1 {
		t.Fatalf("esperava 1 confirmada e 1 projetada, obteve %d/%d", conf, projected)
	}
}

func TestProjectInstallments_RespeitaHorizonteDeMeses(t *testing.T) {
	plans := BuildInstallmentPlans([]InstallmentObservation{
		{AccountID: "a1", Merchant: "Carro", Number: 1, Total: 48, Amount: 500, Date: d(2026, 11, 5)},
	})
	proj := ProjectInstallments(plans, d(2026, 11, 10), 12)
	// Nov/2026 já tem a parcela 1 (observada, fora da projeção); projetadas: dez/2026..out/2027.
	if len(proj.Months) != 11 || proj.Months[0].Month != "2026-12" || proj.Months[10].Month != "2027-10" {
		t.Fatalf("esperava 11 meses de dez/2026 a out/2027, obteve %d", len(proj.Months))
	}
	if proj.TotalCommitted != 47*500 {
		t.Fatalf("TotalCommitted deve cobrir todas as parcelas restantes, obteve %.2f", proj.TotalCommitted)
	}
}
