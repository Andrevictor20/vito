package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TodoRepositorySQLite implementa domain.TodoRepository usando SQLite.
type TodoRepositorySQLite struct {
	db *sql.DB
}

// NewTodoRepository instancia um repositório de tarefas SQLite.
func NewTodoRepository(db *sql.DB) *TodoRepositorySQLite {
	return &TodoRepositorySQLite{db: db}
}

func (r *TodoRepositorySQLite) Create(t *domain.Todo) error {
	query := `
		INSERT INTO todos (id, user_id, title, status, priority, due_date, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, t.ID, t.UserID, t.Title, t.Status, t.Priority, t.DueDate, t.CreatedAt, t.UpdatedAt)
	return err
}

func (r *TodoRepositorySQLite) GetByID(id, userID string) (*domain.Todo, error) {
	query := `
		SELECT id, user_id, title, status, priority, due_date, created_at, updated_at
		FROM todos
		WHERE id = ? AND user_id = ?
	`
	var t domain.Todo
	err := r.db.QueryRow(query, id, userID).Scan(
		&t.ID, &t.UserID, &t.Title, &t.Status, &t.Priority, &t.DueDate, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrTodoNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *TodoRepositorySQLite) ListByUser(userID string, status domain.TodoStatus) ([]domain.Todo, error) {
	var query string
	var args []interface{}

	if status != "" {
		query = `
			SELECT id, user_id, title, status, priority, due_date, created_at, updated_at
			FROM todos
			WHERE user_id = ? AND status = ?
			ORDER BY created_at DESC
		`
		args = []interface{}{userID, status}
	} else {
		query = `
			SELECT id, user_id, title, status, priority, due_date, created_at, updated_at
			FROM todos
			WHERE user_id = ?
			ORDER BY created_at DESC
		`
		args = []interface{}{userID}
	}

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var todos []domain.Todo
	for rows.Next() {
		var t domain.Todo
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &t.Status, &t.Priority, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		todos = append(todos, t)
	}
	return todos, rows.Err()
}

func (r *TodoRepositorySQLite) UpdateStatus(id, userID string, status domain.TodoStatus) error {
	query := `UPDATE todos SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, status, time.Now().UTC(), id, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return domain.ErrTodoNotFound
	}
	return nil
}

func (r *TodoRepositorySQLite) Delete(id, userID string) error {
	query := `DELETE FROM todos WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return domain.ErrTodoNotFound
	}
	return nil
}
