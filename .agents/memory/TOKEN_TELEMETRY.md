# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-27 14:37:51  
> **Sessão:** `584bcc98-650d-4cce-b585-ea6c883c2ed7` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `165.8k` tokens | `1.05M` | **15.81%** | `882.8k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `225.2k` tokens | `800.0k` | **28.15%** | `574.8k` livres | 3 sessões (~45.0k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.22M` tokens | `10.00M` | **52.21%** | `4.78M` livres | 64 sessões (~745.8k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 21.6% |
| **Execuções de Ferramentas** | `117.2k` | 375,093 B | 70.7% |
| **Respostas & Thinking** | `12.0k` | 41,862 B | 7.2% |
| **Mensagens do Usuário** | `881` | 3,524 B | 0.5% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 232 | 113.5k | 363,102 B |
| `EPHEMERAL_MESSAGE` | 13 | 3.6k | 11,423 B |
| `SYSTEM_MESSAGE` | 1 | 177 | 568 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **28.1%** do teto (574.8k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **52.2%** da cota semanal (4.78M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
