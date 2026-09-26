# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 18:17:31  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `82.5k` tokens | `1.05M` | **7.86%** | `966.1k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `527.3k` tokens | `800.0k` | **65.91%** | `272.7k` livres | 7 sessões (~105.5k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.42M` tokens | `10.00M` | **44.24%** | `5.58M` livres | 59 sessões (~632.0k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.3k` | 116,589 B | 42.8% |
| **Execuções de Ferramentas** | `35.4k` | 113,256 B | 42.9% |
| **Respostas & Thinking** | `10.8k` | 37,661 B | 13.0% |
| **Mensagens do Usuário** | `977` | 3,911 B | 1.2% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 81 | 32.4k | 103,811 B |
| `EPHEMERAL_MESSAGE` | 11 | 3.0k | 9,445 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **65.9%** do teto (272.7k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **44.2%** da cota semanal (5.58M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
