package catalog

import (
	"embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/andrevmp/vito/backend/internal/domain"
)

const MaxSkillChars = 700

//go:embed bots/*.json skills/*.json
var embeddedCatalogFS embed.FS

// TriggerSpec define um gatilho padrão sugerido por um bot pronto.
type TriggerSpec struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Cron  string `json:"cron,omitempty"`
}

// BotTemplate representa um bot pronto do catálogo (§4).
type BotTemplate struct {
	Key             string        `json:"key"`
	Version         int           `json:"version"`
	Name            string        `json:"name"`
	Category        string        `json:"category"`
	Goal            string        `json:"goal"`
	Icon            string        `json:"icon"`
	Color           string        `json:"color"`
	Skills          []string      `json:"skills"`
	ExtraActions    []string      `json:"extra_actions,omitempty"`
	DefaultTriggers []TriggerSpec `json:"default_triggers,omitempty"`
	DefaultRules    []string      `json:"default_rules,omitempty"`
	SetupQuestions  []string      `json:"setup_questions,omitempty"`
}

// SkillManifest representa um pacote de habilidade versionado (§5).
type SkillManifest struct {
	Key            string   `json:"key"`
	Version        int      `json:"version"`
	Name           string   `json:"name"`
	Icon           string   `json:"icon"`
	Description    string   `json:"description"`
	When           string   `json:"when"`
	Steps          []string `json:"steps"`
	Actions        []string `json:"actions"`
	OutputContract string   `json:"output_contract"`
}

// Catalog mantém os templates de bots e pacotes de habilidades indexados por chave.
type Catalog struct {
	Templates    []BotTemplate
	Skills       []SkillManifest
	templatesMap map[string]BotTemplate
	skillsMap    map[string]SkillManifest
}

// LoadDefaultCatalog carrega e valida os manifestos embutidos no binário.
func LoadDefaultCatalog() (*Catalog, error) {
	templates, err := loadTemplatesFromFS()
	if err != nil {
		return nil, err
	}
	skills, err := loadSkillsFromFS()
	if err != nil {
		return nil, err
	}
	if err := ValidateCatalog(templates, skills); err != nil {
		return nil, err
	}

	c := &Catalog{
		Templates:    templates,
		Skills:       skills,
		templatesMap: make(map[string]BotTemplate, len(templates)),
		skillsMap:    make(map[string]SkillManifest, len(skills)),
	}
	for _, tpl := range templates {
		c.templatesMap[tpl.Key] = tpl
	}
	for _, sk := range skills {
		c.skillsMap[sk.Key] = sk
	}
	return c, nil
}

// Template retorna um bot pronto pela chave.
func (c *Catalog) Template(key string) (BotTemplate, bool) {
	tpl, ok := c.templatesMap[key]
	return tpl, ok
}

// Skill retorna um pacote de habilidade pela chave.
func (c *Catalog) Skill(key string) (SkillManifest, bool) {
	sk, ok := c.skillsMap[key]
	return sk, ok
}

// ActionsForTemplate calcula a união das ações das habilidades + extra_actions + notify
// com suas políticas padrão do ActionCatalog (§4).
func (c *Catalog) ActionsForTemplate(templateKey string) (map[string]domain.ActionPolicy, error) {
	tpl, ok := c.templatesMap[templateKey]
	if !ok {
		return nil, fmt.Errorf("template %q não encontrado", templateKey)
	}
	out := map[string]domain.ActionPolicy{
		"notify": domain.ActionCatalog["notify"].DefaultPolicy,
	}
	for _, skKey := range tpl.Skills {
		sk, ok := c.skillsMap[skKey]
		if !ok {
			return nil, fmt.Errorf("habilidade %q referenciada por %q não encontrada", skKey, templateKey)
		}
		for _, actKey := range sk.Actions {
			spec, exists := domain.ActionCatalog[actKey]
			if !exists {
				return nil, fmt.Errorf("%w: %s", domain.ErrUnknownAction, actKey)
			}
			out[actKey] = spec.DefaultPolicy
		}
	}
	for _, actKey := range tpl.ExtraActions {
		spec, exists := domain.ActionCatalog[actKey]
		if !exists {
			return nil, fmt.Errorf("%w: %s", domain.ErrUnknownAction, actKey)
		}
		out[actKey] = spec.DefaultPolicy
	}
	return out, nil
}

// SkillCharCount retorna o total de caracteres de texto injetados por um pacote no prompt (§5.1).
func SkillCharCount(sk SkillManifest) int {
	total := utf8.RuneCountInString(sk.Name) +
		utf8.RuneCountInString(sk.Description) +
		utf8.RuneCountInString(sk.When) +
		utf8.RuneCountInString(sk.OutputContract)
	for _, step := range sk.Steps {
		total += utf8.RuneCountInString(step)
	}
	return total
}

// ValidateCatalog garante unicidade de chaves, ações válidas e limites (§5.1, AC-15).
func ValidateCatalog(templates []BotTemplate, skills []SkillManifest) error {
	skillSet := make(map[string]bool, len(skills))
	for _, sk := range skills {
		if strings.TrimSpace(sk.Key) == "" {
			return fmt.Errorf("habilidade com chave vazia")
		}
		if skillSet[sk.Key] {
			return fmt.Errorf("chave de habilidade duplicada: %s", sk.Key)
		}
		skillSet[sk.Key] = true

		if n := SkillCharCount(sk); n > MaxSkillChars {
			return fmt.Errorf("habilidade %q excede %d caracteres (%d)", sk.Key, MaxSkillChars, n)
		}
		for _, act := range sk.Actions {
			if _, ok := domain.ActionCatalog[act]; !ok {
				return fmt.Errorf("habilidade %q referencia ação inexistente %q", sk.Key, act)
			}
		}
	}

	botSet := make(map[string]bool, len(templates))
	for _, tpl := range templates {
		if strings.TrimSpace(tpl.Key) == "" {
			return fmt.Errorf("bot template com chave vazia")
		}
		if botSet[tpl.Key] {
			return fmt.Errorf("chave de bot template duplicada: %s", tpl.Key)
		}
		botSet[tpl.Key] = true

		if len(tpl.Skills) > domain.MaxBotSkills {
			return fmt.Errorf("bot %q excede máximo de %d habilidades (%d)", tpl.Key, domain.MaxBotSkills, len(tpl.Skills))
		}
		for _, skKey := range tpl.Skills {
			if !skillSet[skKey] {
				return fmt.Errorf("bot %q referencia habilidade inexistente %q", tpl.Key, skKey)
			}
		}
		for _, act := range tpl.ExtraActions {
			if _, ok := domain.ActionCatalog[act]; !ok {
				return fmt.Errorf("bot %q referencia ação extra inexistente %q", tpl.Key, act)
			}
		}
	}
	return nil
}

func loadTemplatesFromFS() ([]BotTemplate, error) {
	entries, err := embeddedCatalogFS.ReadDir("bots")
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	var templates []BotTemplate
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		raw, err := embeddedCatalogFS.ReadFile("bots/" + entry.Name())
		if err != nil {
			return nil, err
		}
		var tpl BotTemplate
		if err := json.Unmarshal(raw, &tpl); err != nil {
			return nil, fmt.Errorf("falha ao ler %s: %w", entry.Name(), err)
		}
		templates = append(templates, tpl)
	}
	return templates, nil
}

func loadSkillsFromFS() ([]SkillManifest, error) {
	entries, err := embeddedCatalogFS.ReadDir("skills")
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	var skills []SkillManifest
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		raw, err := embeddedCatalogFS.ReadFile("skills/" + entry.Name())
		if err != nil {
			return nil, err
		}
		var sk SkillManifest
		if err := json.Unmarshal(raw, &sk); err != nil {
			return nil, fmt.Errorf("falha ao ler %s: %w", entry.Name(), err)
		}
		skills = append(skills, sk)
	}
	return skills, nil
}
