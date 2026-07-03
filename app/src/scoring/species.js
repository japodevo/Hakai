// Species fishing profiles for the Hakai Structure Finder scoring engine.
//
// GENERATED from the verified species-intelligence workflow (chinook/coho/lingcod
// researched, adversarially fact-checked across biology / tide / regulations lenses,
// then synthesized into numeric scoring weights). Single editable config for scoring.
//
// NOT navigation, and NOT a substitute for current DFO regulations — verify before you fish.

export const SPECIES = [
  {
    "key": "chinook",
    "label": "Chinook",
    "color": "#ff9f43",
    "localName": "Spring / King; a fish over ~30 lb is a \"Tyee\"",
    "seasonMonths": [
      6,
      7,
      8,
      9
    ],
    "seasonNote": "Core Hakai Passage Chinook window is mid-June through early September. North-bound migratory springs (Fraser, Skeena, mainland-inlet stocks) transit Queen Charlotte Sound and stage/feed through Hakai Passage. June is building; JULY-AUGUST is the peak, with the big Tyee (30 lb+) bite classically firing from mid-July and topping out around the third week of August. September still produces but tapers as effort shifts to coho. ENCODING NOTE: seasonMonths is intentionally the reliable, targetable lodge-season window [6,7,8,9]. May is a genuine early shoulder (many lodges open ~May 20) and resident winter \"feeder\" springs are present year-round, but both are excluded from the scored array as low-reliability — surface May as an unscored \"shoulder\" opportunity rather than hard-gating it to zero. Confidence: high (matches lodge/guide practice and web corroboration).",
    "depthBand": {
      "minM": 15,
      "maxM": 100,
      "primeM": 40,
      "note": "These are SEAFLOOR depths of the structure to target, not lure depth. Chinook here are upper-water-column feeders: the fish and bait sit 10-40 m down regardless of bottom depth. They stack where current-swept structure funnels bait, so score cells along edges where the bottom drops from kelp-line depth (~15 m) into 40-80 m. Prime is ~40 m bottom immediately adjacent to a steeper break. Fish your gear in the top third of the column over these features."
    },
    "tidePhase": {
      "bestPhases": [
        "change",
        "flood",
        "ebb"
      ],
      "currentPreference": "Moving water, moderate flow — the tide change and the building/easing current, NOT peak spring max-flow in the main channel. Fish the tide lines, rips, and back-eddies off the points; on big spring tides work the eddies and the down-current side of points rather than the main channel.",
      "why": "Hakai Passage is a strong tidal funnel; moving tide stacks herring and needlefish against points and along current seams and drives upwelling, which switches the bite on. Best action is the tide-change window (~1 h either side of the turn) and the early build of a new tide; the bite dies at true dead slack, and on big spring tides peak max-flow runs the main pass too hard to fish directly (only small/moderate-range tides fish well at max flow). TIMING CAVEAT: in a high-current pass, slack CURRENT lags the high/low WATER turn by roughly 30-90 min (and max current is not exactly at mid-tide height). The pipeline only has IWLS water-level hi/lo events, no current velocity — so center the tide-change bite window on estimated current slack (apply a lag offset from the hi/lo tick, or widen the window) and surface a 'slack current lags high/low water' note rather than implying they coincide. Both the flood (carrying bait and fish IN from Queen Charlotte Sound) and the ebb (flushing bait out through the pass) produce; the trophy-Tyee window is most reliably the tide change overlapping dawn/dusk on either flow direction, not the ebb alone."
    },
    "scoring": {
      "depthMeanM": 32,
      "depthSigmaM": 20,
      "weights": {
        "prominence": 0.45,
        "slope": 0.5,
        "flatness": 0.15,
        "adjacency": 0.65
      },
      "bottom": {
        "rock": 0.55,
        "gravel": 0.55,
        "soft": 0.45
      },
      "tidePhaseWeight": {
        "slack": 0.2,
        "flood": 0.7,
        "ebb": 0.7,
        "maxFlow": 0.3,
        "change": 1
      }
    },
    "structurePref": [
      {
        "type": "kelp-edge",
        "weight": 0.9,
        "why": "Classic Hakai troll line. Bull-kelp margins on current-swept points (Odlum Pt, Spider I., Barney Pt) hold sandlance/needlefish and juvenile bait; springs cruise tight to the boot/kelp edge feeding. Highest-confidence Chinook structure here."
      },
      {
        "type": "shelf-break",
        "weight": 0.85,
        "why": "Migratory springs follow shelf and bank edges and the tide lines they create; bait piles on the break and upwelling concentrates feed. Prime for staging/travelling fish moving through the passage. (Note: outer banks/shelf-breaks here may fall inside the McMullin/Goose Island RCA — troll/mooch OK, no groundfish retention.)"
      },
      {
        "type": "pinnacle",
        "weight": 0.8,
        "why": "Tide-swept humps/pinnacles force upwelling and bait balls, and create back-eddies where Chinook ambush; strong holding structure when a hump tops into the 15-40 m feeding zone. Check against RCA overlay before jigging."
      },
      {
        "type": "wall",
        "weight": 0.65,
        "why": "Steep current-facing walls generate back-eddies and bait pockets on the down-current side; good when tide is ripping and fish tuck out of the main flow."
      },
      {
        "type": "bench",
        "weight": 0.45,
        "why": "Feeding ledges/shoulders adjacent to a drop hold bait and give cruising fish a shelf to work, but only productive when paired with an adjacent break."
      },
      {
        "type": "flat",
        "weight": 0.2,
        "why": "Open flats are largely transit water for Chinook except where they act as sandlance bait grounds (sand lance burrow in sand/fine gravel) feeding an adjacent edge; low standalone value but a positive bait-ground indicator next to structure."
      }
    ],
    "tactics": [
      {
        "method": "troll",
        "summary": "Primary Hakai method: downrigger troll cut-plug herring or a spoon behind a flasher, S-turning tight along kelp edges and drop-offs.",
        "gear": "Flasher (Bon Chovy / Purple Onion / green-glow) ahead of a 6-7\" cut-plug or whole herring in a teaser head (tandem hook, 5-6 ft leader), or a 3.5-4.5\" glow/nickel spoon (Coho Killer, Kingfisher, G-Force, Skinny G). 2.5-3.5 kt.",
        "presentation": "Roll the cut-plug or work the spoon just off the kelp/break; run the bait 12-20 pulls back off the clip, staggered riggers.",
        "depthNote": "Set riggers 30-90 ft (9-27 m), following bait marks; drop one to 100-120 ft (30-37 m) for bigger fish holding deeper. Fish the top third of the column over 15-100 m bottom."
      },
      {
        "method": "mooch",
        "summary": "Cut-plug / motor-mooch herring along the tide line and points — deadly on big springs, especially right on the tide change.",
        "gear": "Mooching rig, whole or cut-plug herring, 2-6 oz banana/crescent weight sized to current, soft mooching rod.",
        "presentation": "Drop and let the cut-plug spiral naturally, then slow-troll/drift the seam; free-spool on the take and let the fish load before setting.",
        "depthNote": "Work 30-80 ft (9-24 m) down along the current seam off the point; let it swim through the upper feeding zone rather than to bottom."
      },
      {
        "method": "jig",
        "summary": "Situational: vertical-jig a stacked bait ball / pinnacle when fish are marked hard and the troll bite is off. RCA CAUTION: jigging pinnacles is high bottomfish (rockfish/lingcod) bycatch — if the pinnacle is inside a Rockfish Conservation Area, do not retain groundfish; troll/mooch through instead.",
        "gear": "4-8 oz glow/chrome jig (Point Wilson Dart, Delta, or a heavy casting jig) on a braid/mono leader.",
        "presentation": "Drop to just below the mark, sharp lift-and-flutter; keep it in the bait-ball zone. Check the pinnacle against the app's RCA overlay before jigging.",
        "depthNote": "Fish 40-100 ft (12-30 m) over a pinnacle or shelf break where the sounder shows piled bait; secondary to trolling/mooching for Chinook here."
      }
    ],
    "rationaleTemplate": "{structure} at {depth} — fish it on the {tide}",
    "regsNote": "GOVERNING AREA: The core Hakai Pass / Calvert Island fishery is DFO Pacific PFMA Area 8 (subareas around Calvert Island / Hakai Pass, e.g. 8-2 'South Hakai Pass' and 8-4 / Nalau Passage). Confirm your exact subarea before applying limits/closures — closures, RCAs, and Fishery Notices publish by subarea. Area 7 (Bella Bella) is the NEIGHBOUR to the north you may cross into running toward the outer Spider Island / Kildidt grounds, where subarea regs can differ. (Correction applied from review: earlier framing that led with Area 7 and labelled Area 8 as 'Rivers Inlet' is wrong — Rivers Inlet is Area 9.) RETENTION: North Coast (Areas 1-10) minimum size is 62 cm and the summer daily limit has been ~2 Chinook; the annual Chinook limit, where in force, is recorded on your TIDAL WATERS LICENCE (the Salmon Conservation Stamp is the fee endorsement, not the tracking mechanism), and a hard annual cap is area-dependent — verify. CENTRAL/NORTH COAST CONTEXT: Area 8 summer Chinook is generally open at the daily limit; any restriction comes from Area 8-specific DFO Fishery Notices, NOT South Coast Fraser measures — Fraser Chinook non-retention / mark-selective windows apply to Areas 11-29 (Juan de Fuca / Georgia Strait / Gulf Islands), not here. ROCKFISH CONSERVATION AREAS: active RCAs sit in these grounds — West Calvert RCA (Area 8/108) and the McMullin Group & Goose Island RCA on the offshore banks/shelf-breaks. Salmon by troll/mooch is generally permitted inside an RCA, BUT retaining rockfish or lingcod there is prohibited, and the vertical-jig-over-pinnacle tactic is high bottomfish-bycatch and legally exposed inside an RCA. The app must overlay DFO RCA boundaries and hard-exclude RCA cells from lingcod/rockfish scoring; for this Chinook profile, troll/mooch through is fine but do not retain groundfish in an RCA. You MUST check current DFO Fishery Notices and the Area 8 (and 7) pages before fishing — exact 2026 numbers/closures change in-season. Confidence: moderate — framework stable, exact numbers verify in-season. (App is non-navigational; regs verification is the angler's responsibility.)",
    "confidence": "High on season timing (6-9, Jul-Aug peak, mid-Jul-to-late-Aug Tyee window), depth-band and structure relationships, tide behaviour, and tactics — corroborated by Hakai lodge/guide practice and independent web sources and confirmed by the biology and tide reviews. Moderate on regulations: management-area label corrected to Area 8 (subareas around Calvert/Hakai; Area 7 Bella Bella is the northern neighbour), RCA constraints added, annual-limit/stamp wording fixed, and the South Coast Fraser framing removed — but exact 2026 retention numbers and subarea closures must be verified against in-season DFO Fishery Notices."
  },
  {
    "key": "coho",
    "label": "Coho",
    "color": "#54d1a0",
    "localName": "Coho / silver salmon (\"northerns\" / northern coho)",
    "seasonMonths": [
      7,
      8,
      9,
      10
    ],
    "seasonNote": "Hakai Passage is a marquee open-ocean coho fishery on the migratory highway into Queen Charlotte Sound. July = BUILD as northern coho (\"northerns\") stream through feeding hard on needlefish and herring (early-July fish are commonly smaller, ~3-6 lb, growing roughly a pound a month). August-September = PEAK, when 8-15 lb feeders and staging fish are thick along the passage rips and exposed shorelines. October = TAPER/shoulder — most lodges close by mid-to-late September and fish shift toward mainland inlets and natal rivers, so October should be scored as a LOW shoulder, not at parity with the Aug-Sep peak. June is generally too early in the open passage (fish small and sparse). Best combined with early-morning low light overlapping moving water. Encoding note (biology review): seasonMonths keeps [7,8,9,10] but the schema has no per-month weight field, so this Build/Peak/Taper shape lives in this note rather than in the month array — the engine should apply an Aug-Sep peak and an Oct down-weight. Confidence: high on the Jul-Oct window and Aug-Sep peak.",
    "depthBand": {
      "minM": 0,
      "maxM": 30,
      "primeM": 6,
      "note": "Water-COLUMN presentation depth, NOT bottom depth — coho are pelagic, surface-oriented feeders. minM lowered from 2 to 0 (biology review) to include the surface bucktail film where fish take a fast fly right in the surface. Fish the top 0-12 m (0-40 ft); prime recentered to ~6 m (~20 ft) — the original 8 m was a touch deep given the surface-weighted bucktail + shallow-rigger methods pull the effective prime toward 4-6 m. Push riggers toward 20-30 m (60-100 ft) only when bait sounds down or larger northerns mix with chinook. Underlying bottom can be a 10 m kelp reef to 150 m open passage; for coho the seafloor matters only as a bait-concentrating / upwelling feature adjacent to current, NOT as a depth the fish sit on. The depth-band gaussian is deliberately a WEAK, broad term for this species relative to adjacency/current — hence the wide sigma."
    },
    "tidePhase": {
      "bestPhases": [
        "flood",
        "ebb"
      ],
      "currentPreference": "Building-to-moderate current is PRIME — coho want the tide running to build rips, foam lines and colour seams. Strong flow still produces but fish the near-edge seam / back-eddy, not the main torrent; peak-spring max-flow fishes too hard and should be down-weighted (do NOT crown spring-peak windows). The bite fades on dead slack.",
      "why": "Hakai Passage is a powerful tidal channel: sustained flood and ebb currents build the tide rips, foam lines and colour seams that trap needlefish and herring, and coho feed those seams aggressively. Dead slack disperses the bait and shuts the bite off, so slack is deliberately kept OUT of the best phases. The real trigger window is the BUILDING current right after slack (the first of the flood/ebb as the rips re-establish) — not the slack pivot / tide-change surge itself; unlike chinook, coho are sustained-moving-water feeders, not slack/tide-change biters. Overlap moving water with early-morning low light for the best of it."
    },
    "scoring": {
      "depthMeanM": 6,
      "depthSigmaM": 6,
      "weights": {
        "prominence": 0.3,
        "slope": 0.35,
        "flatness": 0.1,
        "adjacency": 0.5
      },
      "bottom": {
        "rock": 0.55,
        "gravel": 0.5,
        "soft": 0.4
      },
      "tidePhaseWeight": {
        "slack": 0.1,
        "flood": 0.9,
        "ebb": 0.9,
        "maxFlow": 0.4,
        "change": 0.45
      }
    },
    "structurePref": [
      {
        "type": "kelp-edge",
        "weight": 0.9,
        "why": "The signature Hakai coho zone. Bucktailing and shallow trolling the bull-kelp and surf line off Calvert Island's exposed shores and off the passage reefs is THE classic method — juvenile herring and needlefish stack in and along the kelp, and coho patrol the outer edge. Highest-confidence coho structure and best bathymetry-detectable proxy for where fish hold."
      },
      {
        "type": "shelf-break",
        "weight": 0.75,
        "why": "Bank and shelf edges where the passage drops into Queen Charlotte Sound force upwelling that concentrates bait and sets up persistent tide lines / foam lines. Coho work these seams; troll the edge and the colour change. Reads through the adjacency term."
      },
      {
        "type": "wall",
        "weight": 0.6,
        "why": "Steep walls of the passage deflect tidal current upward, creating rips and upwelling right where bait gets pinned. Coho hunt the boil and the down-current seam off a wall."
      },
      {
        "type": "pinnacle",
        "weight": 0.55,
        "why": "A pinnacle breaking strong current throws a surface rip and stacks bait balls over and behind it; coho blitz the tide-rip and foam over the high spot. Less bottom-tied than for lingcod/rockfish but a reliable coho magnet on moving water — valued as a rip proxy, not as a spot fish sit on."
      },
      {
        "type": "bench",
        "weight": 0.3,
        "why": "A mid-depth bench can hold bait on its up-current lip but rarely produces the sharp current seam coho key on; secondary."
      },
      {
        "type": "flat",
        "weight": 0.15,
        "why": "Featureless flats give coho nothing to key on unless bait happens to be transiting; lowest weight. Any coho action over a flat is really about a passing tide line, not the bottom — see the modelling note about hydrographic (non-bathymetric) seams."
      }
    ],
    "tactics": [
      {
        "method": "troll (bucktail / surface)",
        "summary": "Bucktail the kelp edge and tide rips — fast surface troll, the iconic Hakai coho technique.",
        "gear": "Blue/green-and-white or all-white polar-bear bucktail flies (or small hootchie), single long line off the rod tip, no weight or 1-2 oz, 15-20 lb mono/leader. A rod flat-lined with a small bright spoon (Coho Killer / Coyote 3.0) works alongside.",
        "presentation": "Run fast — 5-7+ mph — right along the outer bull-kelp fringe, the surf line off exposed points, and through the foam/tide lines. Coho slash a fast-moving surface fly; a long flat line and an aggressive S-troll to speed-and-slow the fly triggers strikes.",
        "depthNote": "Surface to ~3 m (top 10 ft) — a visual, top-of-column presentation right in the surface film."
      },
      {
        "method": "troll (downrigger)",
        "summary": "Shallow flasher-and-spoon downrigger troll along the shelf break / tide line for feeders and northerns.",
        "gear": "Green-glow or army-truck flasher (Hot Spot / O'Ki), 3.0-3.5\" bright spoon (Coho Killer, Kingfisher, Coyote) or green/white hootchie on a short 28-36\" leader. Riggers staggered shallow.",
        "presentation": "Troll faster than for chinook — 3.0-3.5 mph (2.6-3.0 kn) — to match coho aggression. Work the tide lines, the water off the kelp, and the shelf/bank edge. Stagger gear from 10 to 40 ft and let the fish tell you the depth; a fast zig-zag adds flash-and-flutter.",
        "depthNote": "3-12 m (10-40 ft), prime ~6 m (~20 ft); drop toward 20-30 m only if bait sounds down or larger northerns mix with chinook."
      },
      {
        "method": "cast / mooch",
        "summary": "Cast to boiling fish or mooch a cut-plug along the seam when coho are up on bait balls.",
        "gear": "Small casting spoons (Gibbs Croc, Pixee, Blue Fox) for surface feeders; or a cut-plug herring on a mooching leader with 1-3 oz, light mooching rod.",
        "presentation": "When coho are visibly herding bait in a rip or on the tide change, cast a spoon past the boil and rip it back through the school, or slow-mooch a cut-plug herring drifting the tide line and let it spiral in the top of the column. Best on the building current as bait stacks against the re-establishing flow.",
        "depthNote": "Top 0-12 m (0-40 ft) — count the spoon down only a few seconds; keep the cut-plug in the upper column."
      }
    ],
    "rationaleTemplate": "{structure} at {depth} — work the surface rip / tide line on the {tide}.",
    "regsNote": "DFO Pacific, Central Coast. MANAGEMENT AREA (two reviews disagreed on the 7/8 line, so cite both and verify): the boundary runs near Kwakshua Channel / Pruth Bay. Inner/inside waters around Pruth Bay, Kwakshua and the Fitz Hugh Sound side key primarily to AREA 8 (Fitz Hugh Sound / Bella Coola; subarea 8-3 covers part of South Hakai Passage), while the outer/western Hakai Passage open-water grounds and exposed west-Calvert shorelines border AREA 7 (Bella Bella / Denny I.). Salmon are managed together across Areas 7-10, so daily limits do NOT differ between 7 and 8 — this is not a limit error; confirm the exact spot on the DFO subarea map and check both areas' in-season notices if fishing the outside. RETENTION (corrected — both biology and regs reviews): retention is ABUNDANCE-driven and set by in-season Fishery Notice. Central Coast coho are predominantly WILD stocks with negligible hatchery mass-marking, so WILD (adipose-present) coho are normally RETAINABLE here when the fishery is open. Do NOT default to \"only adipose-clipped/hatchery coho retainable, release wild\" — that mark-selective regime is a SOUTH-COAST rule (Areas 11-20, 111, Subareas 29-x) and applying it here would make an angler release legal fish. Central Coast baseline is ~4 coho/day, minimum size 30 cm (fork length); this can be cut to 2/day or non-retention in weak-return years, and mark-selective (clip-only) retention is an EXCEPTION DFO may impose in-season for a stock concern, not the default. A region-wide AGGREGATE limit of 4 salmon/day (all species combined) also applies. RCAs (HIGH — added per regs review): several Rockfish Conservation Areas exist around Calvert Island / Hakai (within the Hakai Luxvbalis Conservancy). DFO prohibits ALL salmon fishing — trolling, jigging AND mooching — inside an RCA, so every coho tactic here (bucktail troll, downrigger troll, cast/mooch) would be ILLEGAL inside one, and these are exactly the kelp-edge / shelf-break / wall / pinnacle features the profile weights highest. The scoring engine MUST treat RCA polygons like the \"no modern survey\" mask: suppress or hard-flag any ranked pin that falls inside an RCA, and overlay the DFO Central Coast RCA boundaries on the chart. Verify RCA boundaries before fishing recommended structure. LICENCE: tidal-waters licence + Salmon Conservation Stamp required. VERIFY the current-year DFO Area 7 & 8 in-season Fishery Notices before fishing — this note is not authoritative. Confidence: moderate (year-specific). No objection here was rejected; the only genuine conflict (Area 7 vs Area 8 as \"primary\") is reconciled above by citing both, because the reviewers place Pruth Bay on opposite sides of an admittedly uncertain subarea line and salmon limits are identical across the two.",
    "confidence": "High on the season window (Jul-Oct, Aug-Sep peak, Oct taper), water-COLUMN presentation depth (top 0-12 m; prime recentered to ~6 m / ~20 ft from 8 m per the biology review, and minM lowered to 0 to include the surface bucktail film), moving-water/rip tide preference, and tactics (bucktailing, shallow flasher-spoon troll, casting to boils / mooching) — all established Hakai practice. TIDE REVIEW APPLIED: \"max-flow\" removed from bestPhases and its weight demoted to 0.4 because the app derives max-flow from the steepest slope of the 15-min tide curve (which peaks on springs), and peak-spring torrent fishes too hard for coho — building-to-moderate flood/ebb (0.9 each) is prime; the \"tide-change surge\" language was corrected to the building current just after slack, and slack is deliberately kept OUT of bestPhases (weight 0.1). Moderate on the terrain/structure weights and bottom preference: coho are current- and bait-driven, not bottom-tied, so all four terrain weights are intentionally SOFT with adjacency (proximity to a drop / shelf-break / wall = rip-forming seam) leading at 0.5, slope 0.35 and prominence 0.3 modest, flatness near zero (0.1); these are lower across the board than chinook and far below lingcod, matching the lingcod>chinook>coho structure-dependence ordering. IMPORTANT MODELLING NOTE (biology review): the single most productive coho feature — the tide rip / foam line / colour seam — is HYDROGRAPHIC, not a seafloor structure, so bathymetry-derived structure detection cannot find it directly; the engine should lean on tidePhaseWeight and treat kelp-edge / shelf-break / wall / pinnacle as rip proxies (and, if a current model + shoreline geometry becomes available, add an explicit tide-line / current-seam term for this species) so a killer seam over low-relief bottom is not under-scored. The depth gaussian is deliberately wide (sigma 6 vs a ~0-12 m core) so depth stays a WEAK discriminator, since the schema exposes no separate depth-weight multiplier. Bottom preference (rock 0.55 / gravel 0.5 / soft 0.4) left UNCHANGED — the biology review confirmed the compressed values are appropriately calibrated, so no change was warranted there. seasonMonths keeps October but, with no per-month weight in the schema, the Oct-taper vs Aug-Sep-peak shape is encoded only in seasonNote. Moderate/low on the regs, which were reframed substantially (wild retention is the Central-Coast default; ~4/day + 30 cm min; RCA salmon-fishing prohibition added) — verify current DFO Area 7 & 8 notices. Web corroboration was not available in-sandbox and no prototype profile config existed to align weight magnitudes against, so terrain weights are reasoned rather than fitted."
  },
  {
    "key": "lingcod",
    "label": "Lingcod",
    "color": "#c56cf0",
    "localName": "Ling",
    "seasonMonths": [
      4,
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "seasonNote": "LEGAL season and PRACTICAL window are different things — the profile now separates them so the app never scores a legally-open month as 'closed'. LEGAL (DFO North/Central Coast outside waters, Areas 1-10, which includes 7/107 and 8/108): lingcod retention is OPEN April 1 - November 15 and CLOSED November 16 - March 31 to protect nest-guarding males (biological spawn roughly Dec-Mar). The earlier 'opens ~May 1' claim was the South Coast / Strait of Georgia rule wrongly generalized and has been removed — April IS open on the Central Coast. PRACTICAL window at Hakai is mid-May through mid-September (lodge season + safe small-boat weather; Queen Charlotte Sound gets exposed and ugly outside that), with the biological PEAK June-August. The aggressive post-spawn feed of April-July is prime where you can get on the water. seasonMonths is set to [4-10] to cover the legally-open, reasonably-targetable shoulders (April and October are open and productive; Nov 1-15 is legally open but weather usually rules it out, so month 11 is left off as a weather call, not a legal one). Verify exact 2026 open/close dates against active DFO Fishery Notices.",
    "depthBand": {
      "minM": 10,
      "maxM": 90,
      "primeM": 40,
      "note": "Hakai lings run from shallow bull-kelp reef edges (~10-15 m, mostly small-to-medium fish, spring/early summer) down to deep offshore pinnacles and bank breaks (60-90 m) that hold the trophy females. Local practice targets shoals roughly 40-200 ft (12-60 m). Prime all-round jigging depth is ~35-50 m (call it 40 m / ~130 ft) on the tops and up-current edges of rock high spots; drop to 55-90 m when specifically hunting big females. Note: 40 m leans slightly deep for a pure numbers day (much outer-coast lingcod comes from 18-37 m) but is a defensible all-round prime given Hakai's deep pinnacle fishery."
    },
    "tidePhase": {
      "bestPhases": [
        "tide-change",
        "slack"
      ],
      "currentPreference": "Light-to-moderate BUILDING or fading water — roughly the hour on either side of slack when current is coming up or dying, NOT dead slack and NOT the full-bore rip. Lings feed hardest when current sweeps bait onto their structure, and the bite typically fires on the first movement after the tide change. In Hakai Passage the true max-flow window is a FISHABILITY dead zone (you cannot hold a jig vertical or keep bottom contact on a pinnacle in the peak rip) rather than a biological feeding shutdown — the fish keep eating in the current shadow, lees and eddies behind structure even at strong flow, you just cannot present to them. You still need heavy lead (8-16 oz) on these shoulders because the current is non-trivial there; that gear and the near-slack-but-moving window are consistent.",
      "why": "Lingcod are ambush predators keyed to current delivering prey. Slack lets you get a heavy jig straight down onto the peak; the feeding switch flips as water starts moving on the change; work the build-up and the fade. IMPORTANT scoring calibration: the heavy max-flow penalty is tuned to Hakai Passage's extreme rip and should be GATED ON MODELED LOCAL CURRENT SPEED, not applied flat across the AOI. On moderate-current rock (Fitz Hugh Sound, sheltered reefs and banks) mid-flood and mid-ebb ARE the prime bite, so flood/ebb should score well there; apply the strong max-flow down-weight only where modeled current exceeds a hold-bottom threshold. Plan drops around the tide change, especially a morning change coinciding with low light."
    },
    "scoring": {
      "depthMeanM": 50,
      "depthSigmaM": 22,
      "weights": {
        "prominence": 0.95,
        "slope": 0.8,
        "flatness": 0.1,
        "adjacency": 0.85
      },
      "bottom": {
        "rock": 1,
        "gravel": 0.4,
        "soft": 0.05
      },
      "tidePhaseWeight": {
        "slack": 0.85,
        "flood": 0.55,
        "ebb": 0.55,
        "maxFlow": 0.2,
        "change": 1
      }
    },
    "structurePref": [
      {
        "type": "pinnacle",
        "weight": 0.97,
        "why": "The number-one lingcod holder at Hakai. Ambush predators sit on top of and around isolated rock pinnacles that rise proud of the surrounding bottom, using the high spot to pounce on bait swept past. Classic local rule: a peak that comes up to ~20 ft with 100 ft on all sides is money."
      },
      {
        "type": "wall",
        "weight": 0.82,
        "why": "Vertical/steep rock walls and their ledges concentrate fish; lings tuck on ledges and pounce into the water column. Current sweeping a wall face delivers food. Fish the base and any shelf on the wall."
      },
      {
        "type": "shelf-break",
        "weight": 0.72,
        "why": "The edge where a bank or shelf drops into deeper water is a prime feeding lane — big lings stage on the break to intercept bait riding the current over the lip. Adjacency-to-drop is a strong signal for this species."
      },
      {
        "type": "bench",
        "weight": 0.55,
        "why": "Rocky benches/terraces adjacent to a drop hold fish, especially where boulder/cobble gives ambush cover next to the edge. Secondary to true pinnacles but productive when tied to a break."
      },
      {
        "type": "kelp-edge",
        "weight": 0.5,
        "why": "Shallow bull-kelp reef edges hold numbers of small-to-medium lings (and the greenling/rockfish they eat) in spring/early summer; good for action, less for trophies. Fish the outer kelp line against rock."
      },
      {
        "type": "flat",
        "weight": 0.12,
        "why": "Featureless soft/flat bottom is near-worthless for lingcod — no ambush cover, no current concentration. Only relevant as the low ground a pinnacle stands out from; score it low."
      }
    ],
    "tactics": [
      {
        "method": "jig",
        "summary": "Vertical jig the tops and up-current edges of rock pinnacles — the bread-and-butter Hakai lingcod method.",
        "gear": "Stout jigging/mooching rod, level-wind or low-gear reel, 65 lb braid to a 40-60 lb mono/fluoro leader. 4-10 oz leadhead with a large soft-plastic swimbait or curl-tail grub (white/glow/dark), or a metal jig (Point Wilson Dart / Deadly Dick / P-Line Laser Minnow). Pinch barbs where required.",
        "presentation": "Free-spool to the bottom, reel up 1-3 ft to clear the rock, then sharp vertical lift-and-drop every ~15 sec, keeping the lure in the bottom 2-4 m. Re-drop every couple of minutes as depth changes so you stay pinned to structure. Hits are a heavy 'stuck-on-bottom' load — swing and hang on. Concentrate drops on the up-current side and crest.",
        "depthNote": "Prime 35-50 m on pinnacle tops; sit right over the peak (e.g. a 20 ft crown surrounded by 100 ft) and work down its up-current shoulder."
      },
      {
        "method": "drift",
        "summary": "Bait-drift whole herring or a live/fresh bait fish across benches, wall bases and shelf-breaks for trophy lings — legal to keep big females here (no upper slot in Areas 7/8).",
        "gear": "Spreader bar or lingcod leader, 8-16 oz banana/cannonball weight to hold bottom on the building/fading shoulders of the tide, 6/0-8/0 hook(s). Whole herring, or better a fresh/live greenling or small rockfish (a hooked rockfish coming up often gets eaten by a big ling — the classic 'double-header' — reel slow and net both).",
        "presentation": "Controlled drift with the current so the bait rides just off bottom along the edge; keep contact and stay on the down-current side of the structure as you pass. Let a grabbing ling chew and load up before setting — don't rip it away.",
        "depthNote": "Best on the 45-90 m breaks and wall bases where the big females live; use enough lead to keep the bait within ~1-2 m of bottom."
      },
      {
        "method": "jig",
        "summary": "Shallow kelp-edge run for numbers when the deep bite is slow or the passage tide is wrong.",
        "gear": "Lighter jigging outfit, 2-4 oz leadhead + swimbait or a bucktail/curl-tail; 40-50 lb leader against the rock and kelp.",
        "presentation": "Cast to the outer kelp line and rocky points with current, let it sink to the reef, and hop it back with sharp lifts. Faster action, mostly smaller-to-medium lings plus incidental greenling/rockfish.",
        "depthNote": "10-25 m along kelp-fringed rock; fish the outside edge of the kelp where it meets deeper rock, best on the building tide."
      }
    ],
    "rationaleTemplate": "{structure} at {depth} — fish it on the {tide}",
    "regsNote": "DFO Pacific — Hakai Passage / Calvert straddles Areas 7 (7/107, Bella Bella-Denny Island) and 8 (8/108, Fitz Hugh Sound). Both sit inside the North/Central Coast OUTSIDE-waters group (Areas 1-10), which share one lingcod rule set, so the straddle does not change the limits. CORRECTED from reviews: (1) Season is OPEN April 1 - November 15, CLOSED November 16 - March 31 (protects nest-guarding males). The prior 'opens ~May 1 / closed Dec-Apr' text was the South Coast rule and was factually wrong for this location — April is open, and the closure is a winter closure, not a spring opener. (2) NO upper/maximum (slot) size limit applies in Areas 7/8 — slot limits are a South Coast (Strait of Georgia) feature — so large breeding females ARE legal to retain, which is exactly what the deep-water trophy tactic targets. The prior 'upper slot in many areas' wording was removed. (3) Minimum size is UNCERTAIN for this area and must be verified: some sources cite 65 cm head-on / 53 cm head-off, but North Coast outside waters may carry no minimum at all; the two reviews conflicted on this, so I flag it rather than assert a firm number. (4) Daily limit 3 lingcod (Areas 1-10); possession limit 6 (2x daily) — confirm the possession figure against the current guide. (5) A Tidal Waters Sport Fishing Licence IS required, but lingcod in these northern/outside waters do NOT require catch recording on the licence (unlike halibut) — the prior 'catch reporting required' claim was over-stated and is scoped out. VALIDATED, kept: Rockfish Conservation Area (RCA) closures prohibit lingcod fishing inside their boundaries — overlay actual RCA polygons in the AOI and EXCLUDE those cells from scoring, same as coverage-gap handling. Confidence MODERATE on exact 2026 dates, minimum-size, and bag/possession numbers; direct DFO page fetches were blocked (403) in research. Verify before the trip at pac.dfo-mpo.gc.ca (Area 7 and Area 8 pages) and check active Fishery Notices for in-season changes.",
    "confidence": "HIGH on biology, depth band, structure and bottom preference, tide/current behaviour, and tactics — all well-corroborated by Hakai Pass local practice (pinnacles/reefs 40-200 ft, moving water triggers the bite, up-current drop-offs) and confirmed textbook-correct by the biology review. MODERATE on the exact 2026 regulatory season dates, the applicable minimum size (reviews conflicted; no upper slot is confirmed), and the bag/possession limits for Areas 7/8 — confirm against current-year DFO Pacific regulations and Fishery Notices before the trip."
  }
]

export const CONTEXT = {
  "regsCalendar": [
    {
      "topic": "VERIFY FIRST — reminders, not legal advice",
      "detail": "Everything in this calendar is a REMINDER TO VERIFY against current DFO Pacific recreational regulations before fishing — specifically the DFO Area 7/8 tidal-waters area page (pac.dfo-mpo.gc.ca), the Groundfish IFMP summary, and any active Fishery Notices (notices.dfo-mpo.gc.ca). This is NOT legal advice. Limits, sizes, windows and RCA boundaries change without notice, sometimes mid-season. The angler is responsible for the rules in force on the day.",
      "months": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ]
    },
    {
      "topic": "Licence, salmon stamp & mandatory catch recording",
      "detail": "A valid BC Tidal Waters Sport Fishing Licence plus a Salmon Conservation Stamp is required to retain any salmon. Each retained chinook must be recorded IMMEDIATELY and permanently on the paper licence, NRLS catch log, or the FishingBC app log. Carry proof offline. (Reminder to verify current requirements.)",
      "months": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ]
    },
    {
      "topic": "Chinook — retention, size & annual cap (Areas 7/8, N/Central Coast)",
      "detail": "Typical North/Central Coast measures: daily limit commonly 2 chinook (sometimes reduced to 1 by notice); minimum size ~62 cm; coast-wide ANNUAL aggregate limit of 10 chinook per licence year (Apr 1–Mar 31). Summer (a July trip) is normally open, but stock-of-concern closures can drop in-season. Management measures reset/take effect April 1 each year. VERIFY the current Area 7/8 chinook notice before departure.",
      "months": [
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ]
    },
    {
      "topic": "Coho — retention window & marked/wild rules",
      "detail": "Coho retention typically opens early-to-mid summer (often around June, sometimes July) once abundance is confirmed; some subareas are hatchery-marked (adipose-clipped) only while others allow wild coho — this VARIES by year and Fishery Notice. Typical daily limit 4; minimum size ~30 cm. Early-season wild-coho non-retention is common. VERIFY marked-vs-wild status and open date for the specific Area 7/8 subarea.",
      "months": [
        6,
        7,
        8,
        9,
        10
      ]
    },
    {
      "topic": "Lingcod — OPEN season (N/Central Coast outside, Areas 1–10)",
      "detail": "Lingcod season on the North/Central Coast is typically OPEN ~April 1 to November 15. Daily limit commonly 3 (outside waters); possession = 2x daily. Some subareas carry a size/slot limit (e.g. a ~65 cm minimum) — VERIFY per subarea. Length is measured from the most-forward base of the pectoral fin to the tip of the middle of the tail. NOTE: even in open season, lingcod is a groundfish and is PROHIBITED inside any Rockfish Conservation Area year-round.",
      "months": [
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11
      ]
    },
    {
      "topic": "Lingcod — CLOSED season",
      "detail": "Lingcod retention is typically CLOSED ~November 16 through March 31 on the North/Central Coast (no retention). Confirm exact closure dates for the year, as they are set by the Groundfish IFMP / Fishery Notice.",
      "months": [
        11,
        12,
        1,
        2,
        3
      ]
    },
    {
      "topic": "Rockfish — aggregate limit & Yelloweye zero-retention",
      "detail": "Rockfish aggregate daily limit is commonly 3 (all rockfish species combined) on the N/Central Coast — VERIFY the current number and sub-limits (e.g. restricted retention of Quillback / China / Tiger). Yelloweye rockfish is typically 0 retention (release). Rockfish is a bottomfish and is PROHIBITED inside any RCA year-round. Barotrauma: use a descending device to release rockfish. (Reminder to verify.)",
      "months": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ]
    },
    {
      "topic": "Rockfish Conservation Areas (RCAs) — bottomfishing closed year-round",
      "detail": "Several RCAs lie in/near Hakai Passage and the Calvert/Hunter Island shorelines (Area 7). Inside an RCA ALL bottomfishing is prohibited year-round: no fishing for or retention of any rockfish, lingcod, or other groundfish, even during the open lingcod season. Salmon angling may be permitted inside some RCAs only under gear restrictions designed to avoid rockfish bycatch — VERIFY. The app must EXCLUDE RCA polygons from lingcod/rockfish scoring and show them as closed. Check the official DFO RCA maps for exact boundaries.",
      "months": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ]
    },
    {
      "topic": "In-season changes — watch Fishery Notices",
      "detail": "New-licence-year measures take effect April 1; DFO can open or close retention (chinook, coho, groundfish) on short notice via Fishery Notices for conservation. Before going offline for a Hakai trip, pull and cache the latest Area 7/8 area page and any active notices, and re-check on return. Treat cached regs as possibly stale.",
      "months": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ]
    }
  ],
  "rockfishConservationNote": "Rockfish Conservation Areas (RCAs) close ALL bottomfishing year-round — no fishing for or retention of rockfish, lingcod, or other groundfish inside the boundary, even when the general lingcod season is open. Multiple RCAs exist in/around Hakai Passage and the Calvert/Hunter Island shorelines (Area 7). Salmon angling may be allowed in some RCAs only under gear restrictions that avoid rockfish bycatch — verify. The app must treat RCA polygons as hard exclusions for lingcod/rockfish scoring and render them as closed zones. Also honour Yelloweye rockfish 0-retention and use descending devices to release rockfish (barotrauma). Boundaries come from the official DFO RCA maps — cache them offline and treat as authoritative. REMINDER: verify against current DFO regulations; not legal advice.",
  "tideWindowRules": {
    "slackDef": "SLACK: the brief period around each predicted high or low tide when the water level's rate of change is ~0 — i.e. |dh/dt| is at/near a local minimum. In the passage the tidal current is near zero here and about to reverse direction. Operationally, flag slack where |dh/dt| falls below a small threshold (e.g. < ~10-15% of the day's peak |dh/dt|) or simply within +/- ~20-30 min of each predicted hi/lo time from the IWLS wlp-hilo series. CAVEAT: in a strong passage like Hakai, CURRENT slack lags the tide-HEIGHT hi/lo by ~20-60 min. THE APP NOW CORRECTS FOR THIS: every current window (slack and max-flow) is shifted ~40 min after the height turn, so the times shown are current times, not tide-table times.",
    "maxFlowDef": "MAX-FLOW: the time of steepest water-level change — the local MAXIMUM of |dh/dt| on the tide curve, occurring roughly midway (in both time and height) between a high and the adjacent low. This is when tidal current through the passage runs fastest. Compute as the extremum of the numerical derivative of the 15-min predicted height series between consecutive hi/lo events. Magnitude scales with the tidal range of that half-cycle, so spring tides (near new/full moon) produce much stronger max-flow than neaps. Because Hakai is mixed semidiurnal, expect ~2 flood and ~2 ebb max-flow periods per ~24 h, of unequal strength. THE APP NOW SCALES FOR THIS: each window's strength and length follow that exchange's actual range — a big spring push scores higher and lasts longer than a soft neap, and spring slacks are shorter.",
    "movingWaterDef": "MOVING-WATER WINDOW: the productive fishing bracket of +/- ~1 h around each max-flow time — steady, strong current that stacks baitfish against points, walls and pinnacles (e.g. Odlum Point) where predators ambush them. The app centers a 'current' window (default +/- 60 min, tunable) on each max-flow time. Treat this as complementary to the SLACK BITE window (also +/- ~1 h, centered on each hi/lo) when the tide change triggers a feeding pulse. Together they mark WHEN to fish; the low-value 'dead' stretches are the fully-slack-to-early-building and the over-ripping peak-spring flows where presentation is hard.",
    "notes": "Hakai Passage funnels open Queen Charlotte Sound water between Calvert and Hunter Islands — a genuinely strong tidal passage; currents rip on spring tides / large ranges and ease on neaps. Local rule of thumb corroborated by search: salmon feed roughly 1 h before, through, and 1 h after slack, AND on the building flood/ebb that pushes bait onto structure. Since no current-station predictions are bundled, DERIVE current timing from IWLS predicted heights (station nearest Pruth Bay ~51.656,-128.123); dh/dt gives max-flow and slack times, but apply the current-lags-height offset. App should surface BOTH slack and max-flow windows per day, tag each with flood/ebb and spring/neap strength, and let the angler choose. Safety/'not for navigation' notice still applies — these are fishing timing aids, not current-station data."
  },
  "hakaiNotes": "Geography: Hakai Passage sits between Calvert Island (south, incl. Pruth Bay) and Hunter Island (north), opening to Queen Charlotte Sound — DFO Pacific Area 7 (adjacent water into Area 8). Mixed semidiurnal tides: two highs and two lows of unequal size daily, so ~2 floods and ~2 ebbs, each with its own slack and max-flow. Currents are strongest on spring tides (near new/full moon) and big ranges; weakest on neaps. Classic producers (Odlum Point and similar points/reefs) work because tidal current pushes baitfish along the structure — fish the moving water onto the point plus the slack bite. Current slack LAGS the tide-height hi/lo (~20-60 min) in a passage this strong, so the app's height-derived slack/max-flow times need a tunable offset. Data plan (per repo): pull IWLS wlp (15-min) + wlp-hilo for the station nearest Pruth Bay (~51.656, -128.123), prefetch the trip range + buffer, and derive current windows on-device from dh/dt since no current-station predictions are bundled. All regulatory content above is a REMINDER TO VERIFY current DFO Pacific regulations and is not legal advice; keep the persistent 'Not for navigation' notice visible. Corroboration was via DFO Pacific Region pages, the Groundfish IFMP, and BC fishing sources through WebSearch (DFO pages block automated fetch, so specific numbers are hedged and flagged to verify)."
}
