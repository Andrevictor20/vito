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
		INSERT INTO todos (id, user_id, title, status, priority, due_date, event_id, event_title, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, t.ID, t.UserID, t.Title, t.Status, t.Priority, t.DueDate, t.EventID, t.EventTitle, t.CreatedAt, t.UpdatedAt)
	return err
}

func (r *TodoRepositorySQLite) GetByID(id, userID string) (*domain.Todo, error) {
	query := `
		SELECT id, user_id, title, status, priority, due_date, COALESCE(event_id, ''), COALESCE(event_title, ''), created_at, updated_at
		FROM todos
		WHERE id = ? AND user_id = ?
	`
	var t domain.Todo
	err := r.db.QueryRow(query, id, userID).Scan(
		&t.ID, &t.UserID, &t.Title, &t.Status, &t.Priority, &t.DueDate, &t.EventID, &t.EventTitle, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrTodoNotFound
		}
		return nil, err
	}
	t.Subtasks, _ = r.ListSubtasksByTodo(t.ID)
	return &t, nil
}

func (r *TodoRepositorySQLite) ListByUser(userID string, status domain.TodoStatus) ([]domain.Todo, error) {
	var query string
	var args []interface{}

	if status != "" {
		query = `
			SELECT id, user_id, title, status, priority, due_date, COALESCE(event_id, ''), COALESCE(event_title, ''), created_at, updated_at
			FROM todos
			WHERE user_id = ? AND status = ?
			ORDER BY created_at DESC
		`
		args = []interface{}{userID, status}
	} else {
		query = `
			SELECT id, user_id, title, status, priority, due_date, COALESCE(event_id, ''), COALESCE(event_title, ''), created_at, updated_at
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
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &t.Status, &t.Priority, &t.DueDate, &t.EventID, &t.EventTitle, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		todos = append(todos, t)
	}

	for i := range todos {
		todos[i].Subtasks, _ = r.ListSubtasksByTodo(todos[i].ID)
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

func (r *TodoRepositorySQLite) AddSubtask(st *domain.Subtask) error {
	query := `
		INSERT INTO todo_subtasks (id, todo_id, title, completed, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, st.ID, st.TodoID, st.Title, st.Completed, st.CreatedAt, st.UpdatedAt)
	return err
}

func (r *TodoRepositorySQLite) ToggleSubtask(id, todoID string) (*domain.Subtask, error) {
	now := time.Now().UTC()
	query := `
		UPDATE todo_subtasks 
		SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END,
		    updated_at = ?
		WHERE id = ? AND todo_id = ?
	`
	res, err := r.db.Exec(query, now, id, todoID)
	if err != nil {
		return nil, err
	}
	affected, err := res.RowsAffected()
	if err != nil || affected == 0 {
		return nil, domain.ErrSubtaskNotFound
	}

	var st domain.Subtask
	selQuery := `SELECT id, todo_id, title, completed, created_at, updated_at FROM todo_subtasks WHERE id = ?`
	err = r.db.QueryRow(selQuery, id).Scan(&st.ID, &st.TodoID, &st.Title, &st.Completed, &st.CreatedAt, &st.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (r *TodoRepositorySQLite) DeleteSubtask(id, todoID string) error {
	query := `DELETE FROM todo_subtasks WHERE id = ? AND todo_id = ?`
	res, err := r.db.Exec(query, id, todoID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil || affected == 0 {
		return domain.ErrSubtaskNotFound
	}
	return nil
}

func (r *TodoRepositorySQLite) ListSubtasksByTodo(todoID string) ([]domain.Subtask, error) {
	query := `
		SELECT id, todo_id, title, completed, created_at, updated_at
		FROM todo_subtasks
		WHERE todo_id = ?
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(query, todoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subtasks []domain.Subtask
	for rows.Next() {
		var s domain.Subtask
		if err := rows.Scan(&s.ID, &s.TodoID, &s.Title, &s.Completed, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		subtasks = append(subtasks, s)
	}
	return subtasks, rows.Err()
}
