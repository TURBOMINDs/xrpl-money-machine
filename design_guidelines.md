{
  "brand": {
    "name": "XRPL Universal Money Machine",
    "personality": [
      "dark-cinematic",
      "premium",
      "high-contrast",
      "neon-accented",
      "phoenix/fire energy",
      "structured-not-cluttered"
    ],
    "north_star": "Feels like a $25/mo pro trading terminal: legible at a glance, intense but controlled, with neon glows used as precision accents (not decoration everywhere)."
  },

  "inspiration_refs": {
    "dashboards": [
      {
        "title": "Crypto Dashboard UI – Dark Mode with Neon Glow (Dribbble)",
        "url": "https://dribbble.com/shots/25670242-Crypto-Dashboard-UI-Dark-Mode-with-Neon-Glow",
        "takeaways": [
          "Neon edge glows + dark glass cards",
          "Clear left nav + dense right panels",
          "Charts framed with subtle borders"
        ]
      },
      {
        "title": "Dribbble crypto dashboard tag",
        "url": "https://dribbble.com/tags/crypto-dashboard",
        "takeaways": [
          "Use bento grids and modular cards",
          "Keep typography crisp; avoid over-gradient"
        ]
      }
    ],
    "alerts_modal": [
      {
        "title": "shadcn dashboard dialog blocks",
        "url": "https://shadcnstudio.com/blocks/dashboard-and-application/dashboard-dialog",
        "takeaways": [
          "Dialog header + description + form sections",
          "Footer actions aligned right",
          "Good spacing rhythm"
        ]
      }
    ]
  },

  "image_urls": {
    "background_embers_overlay": [
      {
        "category": "decorative-overlay",
        "description": "Edge ember/spark overlay for hero corners (use as masked, low-opacity layer; never behind dense text).",
        "url": "https://images.unsplash.com/photo-1566996533071-2c578080c06e?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "decorative-overlay",
        "description": "Sparks on dark sky; good for subtle right-edge overlay behind Live Alerts column.",
        "url": "https://images.pexels.com/photos/266526/pexels-photo-266526.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
      }
    ],
    "phoenix_hero_art": [
      {
        "category": "hero-art",
        "description": "Preferred: custom SVG/illustration (phoenix silhouette + flame strokes). If no custom art, use CSS/SVG flame + ember particles; keep imagery to left side only.",
        "url": "CUSTOM_REQUIRED"
      }
    ]
  },

  "typography": {
    "font_pairing": {
      "display": {
        "name": "Orbitron",
        "fallback": "ui-sans-serif",
        "usage": "XRPL Universal Money Machine title, tier names, key numeric callouts (sparingly)."
      },
      "body": {
        "name": "Manrope",
        "fallback": "ui-sans-serif",
        "usage": "All UI labels, tables, forms, alerts feed, helper text."
      },
      "mono": {
        "name": "Azeret Mono",
        "fallback": "ui-monospace",
        "usage": "AMM/LP addresses, tx hashes, pair IDs, timestamps."
      }
    },
    "google_fonts_import": {
      "instructions": "In /app/frontend/src/index.css add @import for fonts at the very top (before tailwind layers).",
      "css": "@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=Azeret+Mono:wght@400;500;600&display=swap');"
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg text-muted-foreground",
      "section_title": "text-lg md:text-xl font-semibold",
      "card_title": "text-sm font-semibold uppercase tracking-wider",
      "body": "text-sm md:text-base",
      "small": "text-xs text-muted-foreground",
      "mono": "font-mono text-xs md:text-sm"
    },
    "numeric_style": {
      "rule": "Use tabular numbers for prices/amounts.",
      "tailwind": "[font-variant-numeric:tabular-nums]"
    }
  },

  "color_system": {
    "mode": "dark-only",
    "notes": [
      "PRIMARY accents: phoenix orange + neon red + electric blue + ultimate gold.",
      "SECONDARY accents (alerts subsystem only): magenta/violet/pink.",
      "No purple in the main dashboard surfaces; keep violet confined to Price Alerts modal/page."
    ],
    "css_tokens": {
      "instructions": "Replace :root and .dark tokens in /app/frontend/src/index.css with these. Keep HSL format for shadcn compatibility.",
      "tokens": {
        "--background": "240 6% 4%",
        "--foreground": "0 0% 98%",

        "--card": "240 6% 7%",
        "--card-foreground": "0 0% 98%",

        "--popover": "240 6% 6%",
        "--popover-foreground": "0 0% 98%",

        "--muted": "240 5% 14%",
        "--muted-foreground": "240 6% 70%",

        "--border": "240 6% 16%",
        "--input": "240 6% 16%",
        "--ring": "24 100% 55%",

        "--primary": "24 100% 55%",
        "--primary-foreground": "240 6% 6%",

        "--secondary": "200 100% 50%",
        "--secondary-foreground": "240 6% 6%",

        "--accent": "240 5% 12%",
        "--accent-foreground": "0 0% 98%",

        "--destructive": "350 100% 55%",
        "--destructive-foreground": "0 0% 98%",

        "--radius": "0.9rem",

        "--chart-up": "145 85% 45%",
        "--chart-down": "350 100% 55%",
        "--chart-grid": "240 6% 18%",

        "--phoenix-orange": "24 100% 55%",
        "--neon-red": "350 100% 55%",
        "--electric-blue": "195 100% 50%",
        "--ultimate-gold": "40 100% 55%",

        "--alerts-magenta": "330 85% 55%",
        "--alerts-violet": "270 85% 60%",

        "--shadow-ambient": "0 0% 0%",
        "--shadow-glow-orange": "24 100% 55%",
        "--shadow-glow-blue": "195 100% 50%",
        "--shadow-glow-red": "350 100% 55%"
      }
    },
    "allowed_gradients": {
      "rule": "Gradients are decorative only and must not exceed 20% viewport. Use only mild dark-to-slightly-less-dark backgrounds; no saturated purple/pink gradients on main dashboard.",
      "hero_bg": "radial-gradient(1200px 600px at 15% 20%, rgba(255,107,26,0.14), transparent 55%), radial-gradient(900px 500px at 85% 30%, rgba(0,212,255,0.10), transparent 60%), linear-gradient(180deg, rgba(10,10,12,1) 0%, rgba(6,6,8,1) 100%)",
      "alerts_modal_bg_only": "linear-gradient(135deg, rgba(233,30,99,0.18), rgba(147,51,234,0.14))"
    }
  },

  "spacing_radii_shadows": {
    "spacing": {
      "page_padding": "px-4 sm:px-6 lg:px-10",
      "section_gap": "py-10 sm:py-12 lg:py-16",
      "card_padding": "p-4 sm:p-5",
      "dense_row_gap": "gap-3",
      "bento_gap": "gap-4 lg:gap-5"
    },
    "radii": {
      "card": "rounded-2xl",
      "button": "rounded-xl",
      "pill": "rounded-full",
      "input": "rounded-xl"
    },
    "shadow_recipes": {
      "glass_card": "shadow-[0_10px_30px_rgba(0,0,0,0.55)]",
      "neon_orange": "shadow-[0_0_0_1px_rgba(255,107,26,0.35),0_0_24px_rgba(255,107,26,0.18)]",
      "neon_blue": "shadow-[0_0_0_1px_rgba(0,212,255,0.30),0_0_24px_rgba(0,212,255,0.16)]",
      "neon_red": "shadow-[0_0_0_1px_rgba(255,23,68,0.30),0_0_24px_rgba(255,23,68,0.14)]"
    }
  },

  "background_fx": {
    "requirements": [
      "No transparent page background; always solid near-black base.",
      "Use lightweight CSS noise + ember particles at edges.",
      "Avoid heavy 3D libs."
    ],
    "css_scaffold": {
      "instructions": "Add these utility classes in App.css or a new global CSS file; prefer index.css @layer utilities if possible.",
      "css": ".bg-cinematic {\n  background: radial-gradient(1200px 600px at 15% 20%, rgba(255,107,26,0.14), transparent 55%),\n              radial-gradient(900px 500px at 85% 30%, rgba(0,212,255,0.10), transparent 60%),\n              linear-gradient(180deg, rgba(10,10,12,1) 0%, rgba(6,6,8,1) 100%);\n}\n\n.noise-overlay {\n  position: relative;\n}\n.noise-overlay::before {\n  content: '';\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  opacity: 0.06;\n  mix-blend-mode: overlay;\n  background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"180\" height=\"180\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"3\" stitchTiles=\"stitch\"/></filter><rect width=\"180\" height=\"180\" filter=\"url(%23n)\" opacity=\"0.35\"/></svg>');\n}\n\n.ember-edge {\n  position: absolute;\n  inset: -40px;\n  pointer-events: none;\n  opacity: 0.22;\n  filter: blur(0.2px) saturate(1.1);\n  mask-image: radial-gradient(closest-side, rgba(0,0,0,0.9), transparent 70%);\n}\n\n@keyframes emberFloat {\n  0% { transform: translate3d(0, 0, 0); opacity: 0.18; }\n  50% { opacity: 0.28; }\n  100% { transform: translate3d(0, -18px, 0); opacity: 0.18; }\n}\n\n.ember-flicker {\n  animation: emberFloat 6s ease-in-out infinite;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .ember-flicker { animation: none; }\n }"
    },
    "usage": {
      "hero": "<div className=\"bg-cinematic noise-overlay relative overflow-hidden\"> ... <img className=\"ember-edge ember-flicker\" ... /> </div>",
      "note": "Keep ember overlays at corners/edges only; never behind tables/forms."
    }
  },

  "icon_language": {
    "library": "lucide-react",
    "rules": [
      "No emoji icons in UI.",
      "Use lucide icons for alerts (Shield, Gem, TrendingDown/Up, Flame, Bell, Wallet, Activity).",
      "For whale ranks: use custom inline SVG set (simple silhouette icons) stored in /app/frontend/src/assets/ranks/*.svg."
    ],
    "rank_icon_set": {
      "instruction": "Create minimal mono SVGs (stroke-only) for Shrimp/Crab/Octopus/Dolphin/Orca/Shark/Whale/Humpback; color via currentColor and apply neon glow via CSS."
    }
  },

  "layout_grid": {
    "desktop": {
      "pattern": "12-col grid with right rail",
      "structure": [
        "Top: Hero header (left phoenix art + right CTA stack)",
        "Main: 8/12 content (pair form + chart + ranks) + 4/12 right rail (Live Alerts)",
        "Bottom: extended ranks grid + alerts preferences"
      ],
      "tailwind": "grid grid-cols-12 gap-5"
    },
    "tablet": {
      "pattern": "2-column bento",
      "tailwind": "grid grid-cols-1 md:grid-cols-2 gap-4"
    },
    "mobile": {
      "pattern": "single column; Live Alerts becomes collapsible",
      "tailwind": "flex flex-col gap-4"
    }
  },

  "components": {
    "component_path": {
      "shadcn": {
        "Button": "/app/frontend/src/components/ui/button.jsx",
        "Card": "/app/frontend/src/components/ui/card.jsx",
        "Badge": "/app/frontend/src/components/ui/badge.jsx",
        "Dialog": "/app/frontend/src/components/ui/dialog.jsx",
        "Input": "/app/frontend/src/components/ui/input.jsx",
        "Select": "/app/frontend/src/components/ui/select.jsx",
        "Tabs": "/app/frontend/src/components/ui/tabs.jsx",
        "Switch": "/app/frontend/src/components/ui/switch.jsx",
        "RadioGroup": "/app/frontend/src/components/ui/radio-group.jsx",
        "Checkbox": "/app/frontend/src/components/ui/checkbox.jsx",
        "ScrollArea": "/app/frontend/src/components/ui/scroll-area.jsx",
        "Separator": "/app/frontend/src/components/ui/separator.jsx",
        "Tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
        "Sonner": "/app/frontend/src/components/ui/sonner.jsx"
      }
    },

    "recipes": {
      "glass_card": {
        "description": "Dark glass card with subtle border + inner highlight; used for panels, tier cards, chart container.",
        "className": "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
      },
      "neon_border_orange": {
        "description": "Orange neon edge for selected/primary cards.",
        "className": "shadow-[0_0_0_1px_rgba(255,107,26,0.35),0_0_24px_rgba(255,107,26,0.18)] border border-[rgba(255,107,26,0.25)]"
      },
      "neon_border_blue": {
        "description": "Blue neon edge for info/secondary panels.",
        "className": "shadow-[0_0_0_1px_rgba(0,212,255,0.30),0_0_24px_rgba(0,212,255,0.16)] border border-[rgba(0,212,255,0.22)]"
      },
      "neon_border_red": {
        "description": "Red neon edge for sell/danger states.",
        "className": "shadow-[0_0_0_1px_rgba(255,23,68,0.30),0_0_24px_rgba(255,23,68,0.14)] border border-[rgba(255,23,68,0.22)]"
      }
    },

    "blueprints": {
      "XamanLoginButton": {
        "use": ["Button", "Dialog"],
        "visual": "Primary CTA: orange neon with subtle flame shimmer on hover.",
        "tailwind": {
          "button": "rounded-xl bg-[hsl(var(--phoenix-orange))] text-black font-semibold shadow-[0_0_0_1px_rgba(255,107,26,0.35),0_0_24px_rgba(255,107,26,0.18)] hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[hsl(var(--phoenix-orange))]",
          "icon": "mr-2 h-4 w-4"
        },
        "data_testids": {
          "button": "xaman-login-button",
          "open_modal": "xaman-login-open-modal",
          "qr_container": "xaman-login-qr-container"
        }
      },

      "TierCard": {
        "use": ["Card", "Badge", "Button"],
        "layout": "3 cards in a row on desktop; stacked on mobile. Ultimate has gold accent.",
        "states": ["default", "recommended", "current-plan"],
        "className": "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md",
        "accents": {
          "basic": "neon_border_blue",
          "plus": "neon_border_orange",
          "ultimate": "shadow-[0_0_0_1px_rgba(255,170,0,0.35),0_0_26px_rgba(255,170,0,0.16)] border border-[rgba(255,170,0,0.22)]"
        },
        "cta": {
          "primary": "Subscribe/Upgrade/Go Pro",
          "badge": "3 Day Free Trial"
        },
        "data_testids": {
          "card": "tier-card",
          "cta": "tier-card-cta-button",
          "trial_badge": "tier-card-trial-badge"
        }
      },

      "PairInputForm": {
        "use": ["Input", "Button", "Select", "Tabs", "Tooltip"],
        "layout": "Left: AMM/LP address input (mono). Right: action cluster (Create Pair, Clear, Start Tracking, Create Alert).",
        "input_style": "Use mono font + subtle blue ring on focus.",
        "tailwind": {
          "container": "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 sm:p-5",
          "input": "font-mono text-sm bg-black/30 border-white/10 focus-visible:ring-2 focus-visible:ring-[hsl(var(--electric-blue))]",
          "primary_action": "bg-[hsl(var(--phoenix-orange))] text-black hover:brightness-110 active:scale-[0.98]",
          "secondary_action": "bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.09] active:scale-[0.98]"
        },
        "data_testids": {
          "amm_input": "pair-form-amm-address-input",
          "create_pair": "pair-form-create-pair-button",
          "clear": "pair-form-clear-button",
          "start_tracking": "pair-form-start-tracking-button",
          "create_alert": "pair-form-create-alert-button"
        }
      },

      "LiveAlertItem": {
        "use": ["Card", "Badge"],
        "layout": "Right rail feed; each item has icon chip, title, pair, amount, timestamp.",
        "variants": {
          "buy": "orange",
          "liquidity": "green",
          "sell": "red"
        },
        "icon_chip": {
          "base": "h-9 w-9 rounded-xl grid place-items-center border",
          "buy": "bg-[rgba(255,107,26,0.12)] border-[rgba(255,107,26,0.25)] shadow-[0_0_18px_rgba(255,107,26,0.14)]",
          "liquidity": "bg-[rgba(34,197,94,0.10)] border-[rgba(34,197,94,0.22)] shadow-[0_0_18px_rgba(34,197,94,0.12)]",
          "sell": "bg-[rgba(255,23,68,0.10)] border-[rgba(255,23,68,0.22)] shadow-[0_0_18px_rgba(255,23,68,0.12)]"
        },
        "data_testids": {
          "panel": "live-alerts-panel",
          "item": "live-alerts-item",
          "timestamp": "live-alerts-item-timestamp"
        }
      },

      "RankCard": {
        "use": ["Card", "Switch", "Checkbox"],
        "layout": "5-card row for quick ranks; 8-rank grid for full preferences.",
        "visual": "Each card has rank icon, XRP range, and toggles for Price/Activity alerts.",
        "tailwind": {
          "card": "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4",
          "icon": "h-10 w-10 rounded-2xl bg-white/[0.04] border border-white/10 grid place-items-center",
          "toggle_row": "mt-3 flex items-center justify-between"
        },
        "data_testids": {
          "card": "rank-card",
          "price_toggle": "rank-card-price-alert-toggle",
          "activity_toggle": "rank-card-activity-alert-toggle",
          "checkbox": "rank-grid-alert-checkbox"
        }
      },

      "CandlestickChart": {
        "library": "recharts",
        "theme": {
          "container": "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4",
          "grid": "stroke: hsl(var(--chart-grid)); stroke-opacity: 0.55",
          "up": "fill: hsl(var(--chart-up))",
          "down": "fill: hsl(var(--chart-down))",
          "axis": "tick fill: rgba(255,255,255,0.65); axis stroke: rgba(255,255,255,0.10)",
          "tooltip": "bg-black/80 border border-white/10 text-white"
        },
        "timeframe_switcher": {
          "use": ["Tabs"],
          "className": "bg-white/[0.04] border border-white/10 rounded-xl p-1",
          "data_testids": {
            "tabs": "chart-timeframe-tabs",
            "tab": "chart-timeframe-tab"
          }
        }
      },

      "PriceAlertsModal": {
        "scope": "SECONDARY THEME ONLY (magenta/violet)",
        "use": ["Dialog", "Select", "Input", "RadioGroup", "Button", "ScrollArea", "Separator"],
        "visual": "Violet glass card with magenta accent line; primary button uses magenta→violet gradient INSIDE modal only.",
        "modal_surface": "rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(233,30,99,0.10),rgba(147,51,234,0.08))] backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.65)]",
        "primary_button": {
          "className": "rounded-xl text-white font-semibold bg-[linear-gradient(135deg,rgba(233,30,99,0.95),rgba(147,51,234,0.92))] shadow-[0_0_0_1px_rgba(233,30,99,0.25),0_0_26px_rgba(147,51,234,0.18)] hover:brightness-110 active:scale-[0.98]",
          "data_testid": "price-alerts-add-alert-button"
        },
        "secondary_buttons": {
          "enable_notifications": "price-alerts-enable-browser-notifications-button",
          "onesignal_info": "price-alerts-onesignal-info-button"
        },
        "form_testids": {
          "open": "price-alerts-open-modal",
          "alert_type": "price-alerts-alert-type-select",
          "threshold": "price-alerts-threshold-input",
          "currency": "price-alerts-currency-select",
          "radio_group": "price-alerts-condition-radio-group",
          "active_list": "price-alerts-active-alerts-list",
          "log": "price-alerts-alert-log"
        }
      }
    }
  },

  "motion_microinteractions": {
    "principles": [
      "Hover = glow intensifies + slight lift (translateY -1px).",
      "Active press = scale 0.98.",
      "LIVE indicator pulses softly (opacity + glow), not bouncing.",
      "Ember overlay flickers slowly; keep subtle."
    ],
    "tailwind_patterns": {
      "hover_lift": "hover:-translate-y-[1px] transition-[box-shadow,filter,background-color,border-color,opacity] duration-200",
      "press": "active:scale-[0.98]",
      "focus": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0"
    },
    "optional_library": {
      "name": "framer-motion",
      "when": "Only if we need animated list insertions for Live Alerts and modal entrance polish.",
      "install": "npm i framer-motion",
      "usage_hint": "AnimatePresence for alert feed; keep durations 0.18–0.28s; respect prefers-reduced-motion."
    }
  },

  "accessibility": {
    "requirements": [
      "WCAG AA contrast for text on dark surfaces.",
      "Visible focus rings (orange for primary, blue for secondary, magenta only inside alerts modal).",
      "Respect prefers-reduced-motion.",
      "Charts: provide tooltip + legend; never rely on color alone (add ▲/▼ markers)."
    ],
    "keyboard": [
      "Dialog must trap focus (shadcn Dialog already does).",
      "Timeframe tabs must be reachable and show focus state."
    ]
  },

  "instructions_to_main_agent": {
    "global_css": [
      "Remove any centered App header defaults from App.css; do not use .App { text-align:center }.",
      "Set body/html background to cinematic dark using tokens; apply .dark class at root (or set tokens directly in :root since dark-only).",
      "Add Google Fonts import for Orbitron/Manrope/Azeret Mono.",
      "Implement bg-cinematic + noise-overlay utilities and use ember overlays sparingly (corners/edges)."
    ],
    "component_build": [
      "Use shadcn components from /app/frontend/src/components/ui/*.jsx only (Dialog/Select/RadioGroup/etc).",
      "All interactive + key info elements must include data-testid in kebab-case.",
      "Keep violet/magenta strictly scoped to /alerts and PriceAlertsModal; main dashboard uses orange/red/blue only.",
      "Use Recharts theme tokens for candlesticks; ensure grid/axis are subtle and legible."
    ],
    "performance": [
      "Avoid heavy particle libs; use CSS pseudo-elements + one static ember image overlay with low opacity.",
      "Lazy-load large images (hero art) and provide fallback gradient if image fails."
    ]
  },

  "general_ui_ux_design_guidelines": [
    "You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms",
    "You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text",
    "NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json",
    "GRADIENT RESTRICTION RULE",
    "NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc",
    "NEVER use dark gradients for logo, testimonial, footer etc",
    "NEVER let gradients cover more than 20% of the viewport.",
    "NEVER apply gradients to text-heavy content or reading areas.",
    "NEVER use gradients on small UI elements (<100px width).",
    "NEVER stack multiple gradient layers in the same viewport.",
    "ENFORCEMENT RULE:",
    "    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors",
    "How and where to use:",
    "   • Section backgrounds (not content backgrounds)",
    "   • Hero section header content. Eg: dark to light to dark color",
    "   • Decorative overlays and accent elements only",
    "   • Hero section with 2-3 mild color",
    "   • Gradients creation can be done for any angle say horizontal, vertical or diagonal",
    "- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**",
    "- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead.",
    "- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.",
    "- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.",
    "- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly",
    "Component Reuse:",
    "\t- Prioritize using pre-existing components from src/components/ui when applicable",
    "\t- Create new components that match the style and conventions of existing components when needed",
    "\t- Examine existing components to understand the project's component patterns before creating new ones",
    "IMPORTANT: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component",
    "Best Practices:",
    "\t- Use Shadcn/UI as the primary component library for consistency and accessibility",
    "\t- Import path: ./components/[component-name]",
    "Export Conventions:",
    "\t- Components MUST use named exports (export const ComponentName = ...)",
    "\t- Pages MUST use default exports (export default function PageName() {...})",
    "Toasts:",
    "  - Use `sonner` for toasts\"",
    "  - Sonner component are located in `/app/src/components/ui/sonner.tsx`",
    "Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
  ]
}
