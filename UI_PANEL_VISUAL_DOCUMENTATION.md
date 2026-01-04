# UI Panel Shadow DOM - Visual Documentation

## 🎨 Interface Overview

### Layout Structure
```
┌─────────────────────────────────────────┐
│ WhatsApp Web Interface                  │
│                                          │
│                                          │
│                                          │
│                                          │
│                              ┌──────────┤
│                              │ Panel    │
│                              │ Content  │
│                              │          │
│                              │          │
│                              └──────────┤
│                                     [FAB]│
└─────────────────────────────────────────┘
```

## 1. FAB - Floating Action Button

### Appearance (Closed)
```
┌────────────┐
│            │
│     🤖     │  ← Icon centered
│            │
└────────────┘
```
- **Size**: 60x60px (56x56px on mobile)
- **Position**: Fixed, bottom: 24px, right: 24px
- **Background**: Linear gradient (#25D366 → #128C7E)
- **Shape**: Perfect circle (border-radius: 50%)
- **Shadow**: 0 2px 12px rgba(0,0,0,0.15)
- **Hover Effect**: Scale(1.1) + enhanced shadow

### With Notification Badge
```
┌────────────┐
│   [3]      │  ← Red badge with count
│     🤖     │
│            │
└────────────┘
```
- **Badge Position**: top: -4px, right: -4px
- **Badge Color**: #ff4444
- **Badge Size**: min-width: 20px, height: 20px

### Active State (Opened)
```
┌────────────┐
│            │
│     ✕      │  ← Rotated 45deg (becomes a close icon)
│            │
└────────────┘
```
- **Transform**: rotate(45deg)
- **Animation**: Smooth 0.3s transition

## 2. Panel - Main Container

### Dimensions & Position
- **Width**: 380px (calc(100vw - 32px) on mobile)
- **Max Height**: 600px (70vh on mobile)
- **Position**: Fixed, bottom: 100px, right: 24px
- **Background**: var(--background) - white or #111b21
- **Border Radius**: 12px
- **Z-index**: 9999

### Opening Animation
```
Closed State:
  ↓ transform: scale(0.9) translateY(20px)
  ↓ opacity: 0
  ↓ pointer-events: none
  
Open State:
  ↓ transform: scale(1) translateY(0)
  ↓ opacity: 1
  ↓ pointer-events: auto
```

## 3. Header Section

```
┌────────────────────────────────────────┐
│ WhatsHybrid            [ONLINE] [🌙] [✕]│
│ IA • Memória • Campanhas • Contatos    │
└────────────────────────────────────────┘
```

### Components
1. **Title**: "WhatsHybrid" (18px, weight: 600)
2. **Subtitle**: "IA • Memória • Campanhas • Contatos" (12px, opacity: 0.9)
3. **Status Pill**: Rounded badge showing connection status
   - ONLINE: rgba(255,255,255,0.2) background
   - OFFLINE: #ff4444 background
   - AWAY: #ffaa00 background
4. **Theme Toggle**: 🌙 (light mode) or ☀️ (dark mode)
5. **Close Button**: ✕ symbol

### Header Colors
- **Background**: Linear gradient (#25D366 → #128C7E)
- **Text Color**: white
- **Height**: ~70px (with padding)

## 4. Tabs Navigation

```
┌──────────┬──────────┬──────────┬──────────┐
│   🤖     │   📢     │   👥     │   🧠     │
│ Chatbot  │Campanhas │ Contatos │   IA     │
└──────────┴──────────┴──────────┴──────────┘
           ▲
           └─ Active tab indicator (green underline)
```

### Tab States
- **Default**: 
  - Color: var(--text-secondary) - #667781
  - Background: var(--background-secondary)
  - Border: none

- **Hover**:
  - Background: var(--background)
  - Smooth transition

- **Active**:
  - Color: var(--primary) - #25D366
  - Border-bottom: 2px solid #25D366
  - Background: var(--background)

## 5. Content Sections

### Chat Tab Content
```
┌────────────────────────────────────────┐
│ ℹ️ Modo seguro: o chatbot gera texto...│
│                                        │
│ INSTRUÇÃO EXTRA                        │
│ ┌────────────────────────────────────┐│
│ │ Ex.: Responda curto, com tom...   ││
│ └────────────────────────────────────┘│
│                                        │
│ MENSAGENS LIDAS      AÇÃO              │
│ ┌─────────┐         ┌──────────────┐  │
│ │   30    │         │Sugerir resp. ▼│  │
│ └─────────┘         └──────────────┘  │
│                                        │
│ [🚀 Gerar] [🦁 Memória] [💾 Salvar]   │
│                                        │
│ SAÍDA                                  │
│ ┌────────────────────────────────────┐│
│ │ Aqui aparece a resposta...         ││
│ └────────────────────────────────────┘│
│                                        │
│ [📝 Inserir] [📋 Copiar]              │
└────────────────────────────────────────┘
```

### Campaigns Tab Content
```
┌────────────────────────────────────────┐
│ ℹ️ Campanhas: Envie mensagens em massa │
│                                        │
│ NOME DA CAMPANHA                       │
│ ┌────────────────────────────────────┐│
│ │ Ex.: Black Friday 2024             ││
│ └────────────────────────────────────┘│
│                                        │
│ TEMPLATE DA MENSAGEM                   │
│ ┌────────────────────────────────────┐│
│ │ Olá {nome}! Temos uma oferta...    ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │
│ CONTATOS (CSV)                         │
│ [Choose File] campaign.csv             │
│                                        │
│ [▶️ Iniciar] [⏸️ Pausar] [📊 Stats]   │
└────────────────────────────────────────┘
```

### Contacts Tab Content
```
┌────────────────────────────────────────┐
│ ℹ️ Contatos: Gerencie sua base de...  │
│                                        │
│ BUSCAR                                 │
│ ┌────────────────────────────────────┐│
│ │ Nome, telefone ou email...      🔍 ││
│ └────────────────────────────────────┘│
│                                        │
│ [📥 Importar] [📤 Exportar] [🔄 Sync] │
│                                        │
│ RESULTADOS                             │
│ ┌────────────────────────────────────┐│
│ │ João Silva                         ││
│ │ +55 11 99999-0001                  ││
│ │ ────────────────────────────────   ││
│ │ Maria Santos                       ││
│ │ +55 11 99999-0002                  ││
│ └────────────────────────────────────┘│
└────────────────────────────────────────┘
```

### Training Tab Content
```
┌────────────────────────────────────────┐
│ ℹ️ Treinamento: Gerencie exemplos para │
│                                        │
│ EXEMPLOS SALVOS                        │
│ ┌────────────────────────────────────┐│
│ │ Exemplo 1                          ││
│ │ Ex.: Responda curto...             ││
│ │ ────────────────────────────────   ││
│ │ Exemplo 2                          ││
│ │ Ex.: Tom profissional...           ││
│ └────────────────────────────────────┘│
│                                        │
│ [🔄 Carregar] [📤 Export] [📥 Import] │
│                                        │
│ ESTATÍSTICAS DE IA                     │
│ ┌────────────────────────────────────┐│
│ │ Total de exemplos: 42              ││
│ │ Taxa de sucesso: 87.5%             ││
│ │ Última atualização: 04/01 17:45    ││
│ └────────────────────────────────────┘│
└────────────────────────────────────────┘
```

## 6. Color Schemes

### Light Mode
```css
--primary: #25D366         /* WhatsApp Green */
--primary-dark: #128C7E    /* Darker Green */
--secondary: #075E54       /* Deep Green */
--background: #ffffff      /* White */
--background-secondary: #f0f2f5  /* Light Gray */
--text: #111b21           /* Almost Black */
--text-secondary: #667781  /* Gray */
--border: #e9edef         /* Light Border */
```

### Dark Mode
```css
--background: #111b21      /* Dark Blue-Gray */
--background-secondary: #202c33  /* Slightly Lighter */
--text: #e9edef           /* Off-White */
--text-secondary: #8696a0  /* Light Gray */
--border: #2a3942         /* Dark Border */
/* Primary colors remain the same */
```

## 7. Form Elements Style

### Input Fields
```
┌────────────────────────────────────┐
│ Placeholder text...                │
└────────────────────────────────────┘
```
- **Border**: 1px solid var(--border)
- **Border Radius**: 8px
- **Padding**: 10px 12px
- **Focus State**: border-color changes to var(--primary)

### Textarea
```
┌────────────────────────────────────┐
│ Multi-line                         │
│ placeholder text...                │
│                                    │
└────────────────────────────────────┘
```
- **Min Height**: 80px
- **Resize**: vertical
- Same styling as input

### Buttons

#### Primary Button
```
┌──────────────┐
│ 🚀 Gerar     │  ← Green background
└──────────────┘
```
- **Background**: var(--primary) - #25D366
- **Hover**: var(--primary-dark) - #128C7E
- **Color**: white
- **Border Radius**: 8px
- **Padding**: 10px 16px

#### Secondary Button
```
┌──────────────┐
│ 📋 Copiar    │  ← Gray background
└──────────────┘
```
- **Background**: var(--background-secondary)
- **Hover**: var(--border)
- **Color**: var(--text)

### Select Dropdown
```
┌──────────────────────┐
│ Sugerir resposta    ▼│
└──────────────────────┘
```
- Same styling as input
- Native dropdown arrow

## 8. Status Messages

### Success
```
┌────────────────────────────────────┐
│ ✅ Resposta gerada!                │
└────────────────────────────────────┘
```
- **Background**: rgba(37,211,102,0.1)
- **Color**: var(--primary)

### Error
```
┌────────────────────────────────────┐
│ ❌ Erro ao gerar                   │
└────────────────────────────────────┘
```
- **Background**: rgba(255,68,68,0.1)
- **Color**: #ff4444

## 9. Responsive Breakpoint

### Desktop (> 480px)
- Panel width: 380px
- FAB size: 60x60px
- Full features visible

### Mobile (≤ 480px)
- Panel width: calc(100vw - 32px)
- Panel max-height: 70vh
- FAB size: 56x56px
- FAB position: bottom: 16px, right: 16px
- Panel position: bottom: 90px

## 10. Animations

### Panel Open/Close
- **Duration**: 0.3s
- **Easing**: ease
- **Properties**: transform (scale + translateY), opacity

### FAB Rotation
- **Duration**: 0.3s
- **Easing**: ease
- **Rotation**: 45deg when active

### Loader Spinner
- **Animation**: spin 1s linear infinite
- **Size**: 20x20px
- **Colors**: border: var(--border), border-top: var(--primary)

### Button Hover
- **Duration**: 0.2s
- **Easing**: default
- **Properties**: background-color

## 11. Z-Index Layers
```
10000 - FAB (highest)
 9999 - Panel
  ... - WhatsApp content
```

## 12. Scrollbar Styling
```
Width: 6px
Track: var(--background-secondary)
Thumb: var(--border), border-radius: 3px
```

## 13. Note Boxes
```
┌────────────────────────────────────┐
│ ℹ️ Modo seguro: o chatbot gera... │
│ A IA usa contexto do negócio +    │
│ memória + exemplos.                │
└────────────────────────────────────┘
```
- **Background**: var(--background-secondary)
- **Padding**: 12px
- **Border Radius**: 8px
- **Font Size**: 13px
- **Color**: var(--text-secondary)

## 14. Keyboard Shortcuts Visual Feedback

When user presses Ctrl+Shift+W or Escape:
- Console logs the action
- Panel toggles or closes immediately
- No visual indicator (happens instantly)

## 15. Shadow DOM Inspection

In Chrome DevTools:
```
<div id="whatshybrid-panel-container">
  #shadow-root (open)
    <style>...</style>
    <div>
      <button class="fab">...</button>
      <div class="panel">...</div>
    </div>
</div>
```

The shadow root ensures complete style isolation from WhatsApp Web.

## Notes on Implementation

1. **No JavaScript frameworks** - Pure vanilla JS for minimal overhead
2. **CSS Variables** - Easy theme switching without class manipulation
3. **Smooth animations** - 0.3s transitions feel responsive
4. **Accessibility** - Title attributes, semantic HTML
5. **Error handling** - Graceful degradation if systems unavailable
6. **Mobile-first** - Works on all screen sizes
7. **Performance** - Shadow DOM prevents style recalculation
