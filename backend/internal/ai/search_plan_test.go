package ai

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestBuildTriggerSearchPlan_Finance(t *testing.T) {
	plan := BuildTriggerSearchPlan("Ações Petrobras", "Me avise se PETR4 cair abaixo de 35", domain.CategoryFinance)

	if plan.Ticker != "PETR4" {
		t.Errorf("ticker esperado PETR4, obteve %s", plan.Ticker)
	}
	if plan.TargetValue == nil || *plan.TargetValue != 35.0 {
		t.Errorf("target_value esperado 35.0, obteve %v", plan.TargetValue)
	}
	if plan.ComparisonOp != "lte" && plan.ComparisonOp != "lt" {
		t.Errorf("comparison_op esperado 'lte' ou 'lt', obteve %s", plan.ComparisonOp)
	}
	if len(plan.Queries) == 0 {
		t.Errorf("queries não deveriam estar vazias")
	}
}

func TestBuildTriggerSearchPlan_Shopping(t *testing.T) {
	plan := BuildTriggerSearchPlan("Monitorar PS5", "PlayStation 5 lacrado menor que 3800", domain.CategoryShopping)

	if len(plan.ExcludeTerms) == 0 {
		t.Errorf("shopping deve conter termos excludentes (anti-acessório)")
	}
	hasCapa := false
	for _, term := range plan.ExcludeTerms {
		if term == "capa" || term == "pelicula" || term == "película" {
			hasCapa = true
			break
		}
	}
	if !hasCapa {
		t.Errorf("exclude terms deve conter capa ou película")
	}
	if plan.TargetValue == nil || *plan.TargetValue != 3800.0 {
		t.Errorf("target_value esperado 3800, obteve %v", plan.TargetValue)
	}
}

func TestBuildTriggerSearchPlan_Jobs(t *testing.T) {
	plan := BuildTriggerSearchPlan("Vagas Go", "Vaga desenvolvedor backend Go remoto", domain.CategoryCareer)

	if len(plan.Queries) == 0 {
		t.Fatalf("queries não deveriam ser vazias")
	}
	hasGupyOrATS := false
	for _, q := range plan.Queries {
		if containsSubstring(q, "gupy.io") || containsSubstring(q, "linkedin") || containsSubstring(q, "vagas") {
			hasGupyOrATS = true
			break
		}
	}
	if !hasGupyOrATS {
		t.Errorf("queries de emprego devem mirar ATS relevantes: %v", plan.Queries)
	}
	if len(plan.ExcludeTerms) == 0 {
		t.Errorf("jobs deve ter exclude terms para cursos/bootcamps")
	}
}

func TestBuildTriggerSearchPlan_Tender(t *testing.T) {
	plan := BuildTriggerSearchPlan("Concurso BACEN", "Edital concurso banco central 2026", domain.CategoryPublicExams)

	if len(plan.Queries) == 0 {
		t.Fatalf("queries não deveriam ser vazias")
	}
	hasExcludeCursinho := false
	for _, term := range plan.ExcludeTerms {
		if term == "cursinho" || term == "apostila" {
			hasExcludeCursinho = true
			break
		}
	}
	if !hasExcludeCursinho {
		t.Errorf("concursos deve excluir cursinho/apostila: %v", plan.ExcludeTerms)
	}
}

func containsSubstring(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
