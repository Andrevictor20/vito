# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 22:56:12  
> **Sessão:** `18937709-0b90-4a45-89d7-3eaef42fc53a` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `144.4k` tokens | `1.05M` | **13.77%** | `904.2k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `633.5k` tokens | `800.0k` | **79.18%** | `166.5k` livres | 4 sessões (~126.7k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.99M` tokens | `10.00M` | **49.94%** | `5.01M` livres | 61 sessões (~713.4k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 24.8% |
| **Execuções de Ferramentas** | `99.0k` | 316,642 B | 68.5% |
| **Respostas & Thinking** | `9.3k` | 32,655 B | 6.5% |
| **Mensagens do Usuário** | `372` | 1,489 B | 0.3% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 161 | 97.5k | 312,005 B |
| `EPHEMERAL_MESSAGE` | 5 | 1.3k | 4,093 B |
| `SYSTEM_MESSAGE` | 1 | 170 | 544 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **79.2%** do teto (166.5k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **49.9%** da cota semanal (5.01M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
