package adkengine

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/session"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/repository"
)

const (
	defaultMaxCachedSessions = 128
	defaultSessionCacheTTL   = 30 * time.Minute
)

// SQLiteSessionService implementa google.golang.org/adk/v2/session.Service
// adaptando conversation_threads e conversation_turns com suporte a DefaultWriterQueue() e cache LRU limitado.
type SQLiteSessionService struct {
	convRepo    *repository.ConversationStoreRepository
	mu          sync.RWMutex
	sessions    map[string]*sqliteSession
	maxSessions int
	ttl         time.Duration
}

type sqliteSession struct {
	appName   string
	userID    string
	sessionID string
	mu        sync.RWMutex
	state     map[string]any
	events    []*session.Event
	updatedAt time.Time
}

func (s *sqliteSession) ID() string      { return s.sessionID }
func (s *sqliteSession) AppName() string { return s.appName }
func (s *sqliteSession) UserID() string  { return s.userID }
func (s *sqliteSession) State() session.State {
	return &sqliteState{mu: &s.mu, state: s.state}
}
func (s *sqliteSession) Events() session.Events {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return sqliteEvents(slices.Clone(s.events))
}
func (s *sqliteSession) LastUpdateTime() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.updatedAt
}

type sqliteState struct {
	mu    *sync.RWMutex
	state map[string]any
}

func (st *sqliteState) Get(key string) (any, error) {
	st.mu.RLock()
	defer st.mu.RUnlock()
	v, ok := st.state[key]
	if !ok {
		return nil, session.ErrStateKeyNotExist
	}
	return v, nil
}

func (st *sqliteState) Set(key string, val any) error {
	st.mu.Lock()
	defer st.mu.Unlock()
	if st.state == nil {
		st.state = make(map[string]any)
	}
	st.state[key] = val
	return nil
}

func (st *sqliteState) All() iter.Seq2[string, any] {
	st.mu.RLock()
	cloned := maps.Clone(st.state)
	st.mu.RUnlock()
	return func(yield func(string, any) bool) {
		for k, v := range cloned {
			if !yield(k, v) {
				return
			}
		}
	}
}

type sqliteEvents []*session.Event

func (e sqliteEvents) All() iter.Seq[*session.Event] {
	return func(yield func(*session.Event) bool) {
		for _, ev := range e {
			if !yield(ev) {
				return
			}
		}
	}
}
func (e sqliteEvents) Len() int { return len(e) }
func (e sqliteEvents) At(i int) *session.Event {
	if i >= 0 && i < len(e) {
		return e[i]
	}
	return nil
}

// NewSQLiteSessionService cria o serviço de sessão ADK sobre ConversationStoreRepository.
func NewSQLiteSessionService(convRepo *repository.ConversationStoreRepository) *SQLiteSessionService {
	return &SQLiteSessionService{
		convRepo:    convRepo,
		sessions:    make(map[string]*sqliteSession),
		maxSessions: defaultMaxCachedSessions,
		ttl:         defaultSessionCacheTTL,
	}
}

// SetCacheLimitsForTest configura limites de LRU e TTL para testes determinísticos.
func (s *SQLiteSessionService) SetCacheLimitsForTest(maxSessions int, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if maxSessions > 0 {
		s.maxSessions = maxSessions
	}
	if ttl > 0 {
		s.ttl = ttl
	}
}

func (s *SQLiteSessionService) evictLocked(now time.Time) {
	if s.ttl > 0 {
		for k, sess := range s.sessions {
			sess.mu.RLock()
			expired := now.Sub(sess.updatedAt) > s.ttl
			sess.mu.RUnlock()
			if expired {
				delete(s.sessions, k)
			}
		}
	}
	limit := s.maxSessions
	if limit <= 0 {
		limit = defaultMaxCachedSessions
	}
	for len(s.sessions) >= limit {
		var oldestKey string
		var oldestTime time.Time
		for k, sess := range s.sessions {
			sess.mu.RLock()
			ut := sess.updatedAt
			sess.mu.RUnlock()
			if oldestKey == "" || ut.Before(oldestTime) {
				oldestKey = k
				oldestTime = ut
			}
		}
		if oldestKey == "" {
			break
		}
		delete(s.sessions, oldestKey)
	}
}

func sessionMapKey(appName, userID, sessionID string) string {
	return appName + "|" + userID + "|" + sessionID
}

// Create cria ou inicializa uma sessão ADK persistindo a thread no SQLite via ConvRepo (que já usa ExecuteQueuedWrite).
func (s *SQLiteSessionService) Create(ctx context.Context, req *session.CreateRequest) (*session.CreateResponse, error) {
	if req.AppName == "" || req.UserID == "" {
		return nil, fmt.Errorf("app_name e user_id são obrigatórios")
	}
	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	channel := "app_mobile"
	if req.State != nil {
		if ch, ok := req.State["channel"].(string); ok && ch != "" {
			channel = ch
		}
	}

	if s.convRepo != nil {
		_, _ = s.convRepo.GetOrCreateThread(ctx, req.UserID, channel, sessionID)
	}

	initialState := make(map[string]any)
	if req.State != nil {
		maps.Copy(initialState, req.State)
	}

	now := time.Now().UTC()
	sess := &sqliteSession{
		appName:   req.AppName,
		userID:    req.UserID,
		sessionID: sessionID,
		state:     initialState,
		events:    loadHistoricalEventsFromSQLite(ctx, s.convRepo, sessionID),
		updatedAt: now,
	}

	s.mu.Lock()
	s.evictLocked(now)
	s.sessions[sessionMapKey(req.AppName, req.UserID, sessionID)] = sess
	s.mu.Unlock()

	return &session.CreateResponse{Session: sess}, nil
}

// Get recupera uma sessão ativa ou reconstrói a partir de conversation_threads / conversation_turns.
func (s *SQLiteSessionService) Get(ctx context.Context, req *session.GetRequest) (*session.GetResponse, error) {
	if req.AppName == "" || req.UserID == "" || req.SessionID == "" {
		return nil, fmt.Errorf("app_name, user_id e session_id são obrigatórios")
	}

	key := sessionMapKey(req.AppName, req.UserID, req.SessionID)
	s.mu.RLock()
	existing, ok := s.sessions[key]
	s.mu.RUnlock()

	if ok {
		return &session.GetResponse{Session: existing}, nil
	}

	if s.convRepo != nil {
		thread, err := s.convRepo.GetThreadByID(ctx, req.SessionID)
		if err == nil && thread != nil && thread.UserID == req.UserID {
			sess := &sqliteSession{
				appName:   req.AppName,
				userID:    req.UserID,
				sessionID: req.SessionID,
				state: map[string]any{
					"channel": thread.Channel,
				},
				events:    loadHistoricalEventsFromSQLite(ctx, s.convRepo, req.SessionID),
				updatedAt: thread.UpdatedAt,
			}
			s.mu.Lock()
			s.evictLocked(time.Now().UTC())
			s.sessions[key] = sess
			s.mu.Unlock()
			return &session.GetResponse{Session: sess}, nil
		}
	}

	return nil, fmt.Errorf("%w: %q", session.ErrNotFound, req.SessionID)
}

// List retorna as sessões do usuário.
func (s *SQLiteSessionService) List(ctx context.Context, req *session.ListRequest) (*session.ListResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var list []session.Session
	for _, sess := range s.sessions {
		if sess.appName == req.AppName && (req.UserID == "" || sess.userID == req.UserID) {
			list = append(list, sess)
		}
	}
	return &session.ListResponse{Sessions: list}, nil
}

// Delete remove uma sessão da memória e do SQLite.
func (s *SQLiteSessionService) Delete(ctx context.Context, req *session.DeleteRequest) error {
	s.mu.Lock()
	delete(s.sessions, sessionMapKey(req.AppName, req.UserID, req.SessionID))
	s.mu.Unlock()

	if s.convRepo != nil && req.SessionID != "" {
		return s.convRepo.DeleteThread(ctx, req.SessionID)
	}
	return nil
}

// AppendEvent adiciona um evento não-parcial à sessão e atualiza o StateDelta.
func (s *SQLiteSessionService) AppendEvent(ctx context.Context, curSession session.Session, event *session.Event) error {
	if curSession == nil || event == nil {
		return errors.New("session e event não podem ser nulos")
	}
	if event.Partial {
		return nil
	}
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	key := sessionMapKey(curSession.AppName(), curSession.UserID(), curSession.ID())
	s.mu.RLock()
	stored, ok := s.sessions[key]
	s.mu.RUnlock()
	if !ok {
		return fmt.Errorf("%w: %q", session.ErrNotFound, curSession.ID())
	}

	stored.mu.Lock()
	defer stored.mu.Unlock()

	if len(event.Actions.StateDelta) > 0 {
		if stored.state == nil {
			stored.state = make(map[string]any)
		}
		for k, v := range event.Actions.StateDelta {
			if !strings.HasPrefix(k, session.KeyPrefixTemp) {
				stored.state[k] = v
			}
		}
	}

	evCopy := *event
	stored.events = append(stored.events, &evCopy)
	stored.updatedAt = event.Timestamp
	return nil
}

// SeedClientHistory injeta histórico enviado pelo cliente quando a sessão SQLite é nova.
func (s *SQLiteSessionService) SeedClientHistory(appName, userID, sessionID string, turns []struct{ Role, Content string }) {
	s.SeedClientHistoryWithReset(appName, userID, sessionID, turns, false)
}

// SeedClientHistoryWithReset injeta histórico do cliente e, quando reset=true (edição/reenvio), substitui os eventos em cache.
func (s *SQLiteSessionService) SeedClientHistoryWithReset(appName, userID, sessionID string, turns []struct{ Role, Content string }, reset bool) {
	key := sessionMapKey(appName, userID, sessionID)
	s.mu.RLock()
	sess, ok := s.sessions[key]
	s.mu.RUnlock()
	if !ok || sess == nil {
		return
	}

	sess.mu.Lock()
	defer sess.mu.Unlock()
	if len(sess.events) > 0 && !reset {
		return
	}
	if reset {
		sess.events = nil
	}

	now := time.Now().UTC().Add(-time.Duration(len(turns)+1) * time.Second)
	for i, t := range turns {
		role := genai.RoleUser
		author := "user"
		if strings.EqualFold(t.Role, "assistant") || strings.EqualFold(t.Role, "model") {
			role = genai.RoleModel
			author = "vito_executive"
		}
		ev := &session.Event{
			ID:           fmt.Sprintf("hist_%s_%d", sessionID, i),
			InvocationID: "seed_" + sessionID,
			Timestamp:    now.Add(time.Duration(i) * time.Second),
			Author:       author,
			LLMResponse: model.LLMResponse{
				Content: &genai.Content{
					Role:  role,
					Parts: []*genai.Part{{Text: t.Content}},
				},
			},
		}
		sess.events = append(sess.events, ev)
	}
}

func loadHistoricalEventsFromSQLite(ctx context.Context, convRepo *repository.ConversationStoreRepository, threadID string) []*session.Event {
	if convRepo == nil || threadID == "" {
		return nil
	}
	turns, err := convRepo.GetRecentTurns(ctx, threadID, 12)
	if err != nil || len(turns) == 0 {
		return nil
	}
	var events []*session.Event
	for _, t := range turns {
		if strings.TrimSpace(t.Content) == "" {
			continue
		}
		role := genai.RoleUser
		author := "user"
		switch strings.ToLower(t.Role) {
		case "assistant", "model":
			role = genai.RoleModel
			author = "vito_executive"
		case "tool":
			continue
		}
		events = append(events, &session.Event{
			ID:           t.ID,
			InvocationID: "hist_" + t.ID,
			Timestamp:    t.CreatedAt,
			Author:       author,
			LLMResponse: model.LLMResponse{
				Content: &genai.Content{
					Role:  role,
					Parts: []*genai.Part{{Text: t.Content}},
				},
			},
		})
	}
	return events
}
