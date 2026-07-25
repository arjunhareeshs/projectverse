# Grassroots Innovation Extraction — Full Documentation

This document combines everything covered so far: what the task actually
asks for, how the dataset was sourced, every link used, and where to go to
extend the dataset to the full 150-300 independent-story scale the
assignment describes.

---

## 1. What the task is asking for

Fine-tune a small LLM to turn a messy paragraph about a grassroots
innovation into a compact, structured extraction:

```json
{"problem": "1-2 sentence problem statement", "solution": "1-2 sentence solution"}
```

Input → output shape:

- **Input**: a paragraph describing one innovator's story (who they were,
  what they struggled with, what they built).
- **Output**: exactly two fields — `problem` (what need/pain point
  existed) and `solution` (what they built/did about it) — nothing else.

This is the same shape as extracting structured fields from any messy
document (tickets, invoices, reports); grassroots-innovation stories are
just the domain used here. The point of the exercise is to show a small
fine-tuned model can do this focused extraction more cheaply than an API
LLM at scale, while matching it closely enough on quality.

## 2. What was built (recap of deliverables)

Delivered as `grassroots-extraction.zip` in the previous message:

```
data/train.jsonl        122 rows / 30 unique stories
data/val.jsonl            16 rows /  4 unique stories
data/test.jsonl           12 rows /  3 unique stories
build_dataset.py          generates the dataset above from 37 sourced cases (seeded, rerunnable)
prompts.py                shared prompt template for train.py and eval.py
train.py                  LoRA fine-tuning script (HF Trainer + PEFT), Qwen2.5-0.5B-Instruct
eval.py                   baseline vs fine-tuned evaluation, ROUGE-L + JSON parse rate
results.md                metrics table template + qualitative-example scaffold (not yet run — no GPU here)
README.md                 model choice + LoRA config defense + cost estimate
SOURCES.md                per-case source list + honesty disclosures
```

## 3. Sourcing methodology (how the data was actually collected)

1. Searched the web for Honey Bee Network / NIF (National Innovation
   Foundation-India) grassroots-innovator coverage.
2. Cross-checked names, states, and the technical facts of each innovation
   against at least one real, citable source (NIF's own site, Wikipedia,
   or a secondary news write-up).
3. Wrote the paragraph text and the `problem`/`solution` labels **myself**,
   in my own words, from those facts — not copied from any source (to
   respect copyright and to be explicit that these are LLM-authored labels,
   not hand-verified ground truth).
4. Expanded each of the 37 sourced cases into 4-5 differently-worded
   paragraphs (disclosed data augmentation) to reach a usable row count.
5. Split **by story, not by row** into train/val/test, so no paraphrase of
   a test-set story ever appears in training.

This is exactly the "bootstrap labels with an API LLM, then be honest about
what's human-verified vs auto-generated" path the task brief explicitly
allows — **none of these 37 cases have been hand-verified by a second human
reviewer**, only sourced and paraphrased by me. Treat it as a solid starter
corpus, not a certified gold-label benchmark.

## 4. Every source link used, deduplicated and categorized

### NIF (National Innovation Foundation-India) — official site
- https://nif.org.in/aboutnif — mission, scale of NIF's database, award history
- https://nif.org.in/initiatives — GTIAF, Gandhian Inclusive Innovation Challenge, Grassroots to Global
- https://nif.org.in/foin-2015 — 1st Festival of Innovation (2015), award numbers
- https://nif.org.in/biennial-award-function/22 — biennial award-function index page
- https://nif.org.in/upload/11th-Final-Award-Book-April-2023.pdf — **11th National Biennial Award Book (PDF)** — a real, multi-page list of dozens of named innovators + their innovations; best single source to scale the dataset up
- https://nif.org.in/innovation/groundnut-digger/745 — Yusuf Khan, groundnut digger (full case writeup incl. "problem addressed" section)
- https://nif.org.in/innovation/mobile-groundnut-thresher-cum-collector/585 — Mohanbhai, mobile thresher
- https://nif.org.in/innovation/mobile-groundnut-thresher/1096 — Nileshbhai & Pankaj, mobile thresher variant
- https://nif.org.in/innovation/herbal_formulation_kamaal_505/364 — Ishwar Singh Kundu, herbal formulation
- https://nif.org.in/innovation/contribution_for_hone_bee_network/403 — student contributions to Honey Bee Network
- https://nif.org.in/news/339 — "Rural Innovations: Transforming Lives" (roundup of several innovators)
- https://nif.org.in/news/485 — Padma Shri 2019 announcement (Parikh, Bharali, Marvaniya)
- https://nif.org.in/news/535 — "Journey of an innovator to an innovation influencer" (Sundaram Verma + 5 innovators he scouted)
- https://nif.org.in/vard_agriculture — NIF's agriculture R&D department overview
- https://nif.org.in/DSD — Dissemination and Social Diffusion department, farmer field schools
- https://nif.org.in/ — homepage, live NIF news ticker

### Honey Bee Network — coverage and archives
- https://nalakagunawardene.com/2011/12/16/3-idiots-and-honey-bee-network-launch-indias-grassroots-innovators-into-a-new-orbit/ — Remya Jose, Appachan, Mohd. Saidullah, Dhanjibhai Kerai (with named innovations)
- https://www.slideshare.net/pragyamodi/honey-bee-network-1808139 — compiled list of bicycle-based Honey Bee Network innovations (8 named innovators)
- http://honeybee.org/HBNCRIIA-2020.php — Honey Bee Network Creativity & Inclusive Innovation Awards 2020
- https://honeybee.org/ — Honey Bee Network main site
- https://anilg.sristi.org/honey-bee-network-creativity-inclusive-innovation-awards-hbncriia-2020/ — Prof. Anil Gupta's blog, HBNCRIIA award background
- https://gian.org/honeybee/ and https://gian.org/hbncriia-India/ — GIAN (Honey Bee Network's incubator), award criteria
- https://www.culturalsurvival.org/publications/cultural-survival-quarterly/honey-bee-network-voices-grassroots-innovators — background essay on the movement
- https://tcleadership.org/the-honey-bee-network/ — leadership/movement history angle

### Academic / policy background on Honey Bee Network & NIF
- https://www.researchgate.net/publication/24089992_From_Sink_to_Source_The_Honey_Bee_Network_Documents_Indigenous_Knowledge_and_Innovations_in_India — history of NIF's founding (1999-2000), Remya Jose case detail
- https://www.researchgate.net/publication/292667133_The_honey_bee_network_Linking_knowledge-rich_grassroots_innovation — open-innovation framing of the network
- https://www.researchgate.net/publication/276329889_Understanding_the_diffusion_modes_of_grassroots_innovations_in_India_A_study_of_Honey_Bee_Network_supported_innovators — diffusion-mode study using NIF's own database
- https://arxiv.org/pdf/2202.08649 — ICT-for-agriculture paper with a section on Honey Bee Network/NIF/TKDL
- https://www.indiascienceandtechnology.gov.in/organisations/ministry-and-departments/department-science-technology-dst/national-innovation — ISTI government portal profile of NIF
- https://dst.gov.in/national-innovation-foundation-india-drives-grassroot-innovation-movement-country — DST's own summary of NIF's scale and impact
- https://fincomindia.nic.in/asset/doc/commission-reports/13th-FC/statebooks/JH/book1.pdf and .../MH/book1.pdf — 13th Finance Commission state books with NIF background text (Jharkhand, Maharashtra editions)

### Wikipedia (individual innovator biographies)
- https://en.wikipedia.org/wiki/Vallabhbhai_Marvaniya — Madhuban Gajar carrot variety, Padma Shri 2019
- https://en.wikipedia.org/wiki/C._V._Raju — traditional toy-craft revival, UNESCO recognition
- https://en.wikipedia.org/wiki/Abdul_Khader_Nadakattin — tamarind seed separator, seed-cum-fertiliser drill, wheel tiller, Padma Shri 2022
- https://en.wikipedia.org/wiki/Uddhab_Bharali — pomegranate deseeder, 160+ inventions, Padma Shri 2019

### News coverage
- https://krishijagran.com/industry-news/grassroots-innovators-honoured-at-honey-bee-network-awards-2024-for-transformative-solutions/ — Honey Bee Network Awards 2024 roundup
- https://www.devdiscourse.com/article/science-environment/1899216-grassroots-innovator-from-karnataka-amongst-107-padma-shri-awardees-announced — Nadakattin Padma Shri 2022 profile
- https://ecoideaz.com/innovative-green-ideas/nifs-award-winning-grassroots-innovators-from-rural-india/ — Manipur poultry-herbal case (3 named women innovators), Manihar Sharma

## 5. Where to go to reach the full 150-300 *independent* stories

The 37 cases here are real but were gathered in one session; scaling to
150-300 fully independent (non-paraphrased) stories means pulling more rows
from primary lists rather than re-paraphrasing what's already here. Best
next sources, in priority order:

1. **NIF Biennial Award Books (PDF)** — each covers dozens of named
   innovators with innovation title, state, and award category in one
   document. Only the 11th (2023) book was pulled from this session:
   https://nif.org.in/upload/11th-Final-Award-Book-April-2023.pdf
   The index of all editions is at https://nif.org.in/biennial-award-function
   — fetch each edition's book (1st through 11th, 2001-2023) for a large
   jump in unique, real cases.
2. **NIF State Innovation Books** — https://nif.org.in/publications/6 —
   state-by-state compilations, useful for filling in regions the current
   37 cases under-represent.
3. **NIF's own per-innovation pages** — pages like
   `nif.org.in/innovation/<slug>/<id>` (as used for the groundnut digger,
   mobile thresher, and herbal formulation cases above) often include a
   "Problem addressed" paragraph in NIF's own words — useful as a factual
   base to paraphrase from, the same way this dataset's labels were built.
4. **NIF's "Innovation Frontline" publication and Annual Reports** —
   https://nif.org.in/publications — narrative write-ups of many cases per
   issue.
5. **National Innovation Portal** — https://innovation.nif.org.in/ — a
   searchable database front-end to NIF's full ~3.75 lakh-entry archive
   (per https://nif.org.in/aboutnif); the richest single source if it
   supports bulk browsing, though it wasn't crawled in this session.

If you want, I can go fetch a batch of these (e.g. the 1st-10th award
books) in a follow-up pass and extend `build_dataset.py`'s `CASES` list —
that's the concrete path from 37 to 150-300 independently-sourced stories.

## 6. The 37 cases currently in the dataset (quick reference)

| # | Innovator | Place | Innovation (one line) |
|---|---|---|---|
| 1 | Remya Jose | Palakkad, Kerala | Pedal-powered washing machine |
| 2 | Appachan | Kerala | Mechanical tree-climbing device |
| 3 | Mohammad Saidullah | Bihar | Amphibious bicycle |
| 4 | Dhanjibhai Kerai | Gujarat | Scooter modified for physically challenged riders |
| 5 | Mansukhbhai Jagani | Gujarat | Bicycle-mounted pesticide sprayer |
| 6 | Jayanti J. Patel | Gujarat | Geared bicycle |
| 7 | Dodhi Pathak | Assam | Bamboo-frame bicycle |
| 8 | Subhas Vasantrao Jagtap | Maharashtra | Bicycle-based spray pump |
| 9 | Md. Kamruddin | Rajasthan | Multipurpose bicycle |
| 10 | Vikram Rathore | Andhra Pradesh | Bicycle-operated water pump |
| 11 | Nasiruddin Gayen | West Bengal | Bicycle-based portable pump |
| 12 | Kanak Das | Assam | Rider-induced bicycle |
| 13 | Vallabhbhai Marvaniya | Junagadh, Gujarat | Madhuban Gajar carrot variety |
| 14 | C. V. Raju | Andhra Pradesh | Traditional toy-craft revival |
| 15 | Dipak Sardar | West Bengal | Sola wood sheet-making machine |
| 16 | Kishan Lal Suthar | Rajasthan | Tractor-operated groundnut decorticator-cum-grader |
| 17 | Ram Vilas Maurya | Uttar Pradesh | G-Vilas Pasand guava variety |
| 18 | Aniyamma Baby | Kerala | Multiple-rooting propagation method for cashew |
| 19 | Ravi Ganpat Chopade | Maharashtra | Six-axis rotating-head golden embossing machine |
| 20 | Sadasibo Majhi | Odisha | Manual paddy transplanter |
| 21 | Yusuf Khan | Gujarat | Tractor-operated groundnut digger |
| 22 | Jagdish Prasad Parikh | Rajasthan | Pest/climate-resistant cauliflower variety |
| 23 | Santosh Pachar | Rajasthan | New carrot variety |
| 24 | Madanlal Kumawat | Rajasthan | Multi-crop thresher |
| 25 | Subhash Ola | Rajasthan | Condensate and heat recovery system |
| 26 | Rai Singh Dahiya | Rajasthan | Biomass gasifier system |
| 27 | Sundaram Verma | Rajasthan | Dryland farming / water-conservation research |
| 28 | Indrajit Singh Khass | (region unconfirmed) | Tractor-mounted turmeric & ginger planter |
| 29 | Mohanbhai | Sabarkantha, Gujarat | Tractor-mounted mobile groundnut thresher cum collector |
| 30 | Nileshbhai & Pankaj | Gujarat | Modified mobile automatic groundnut thresher |
| 31 | Abdul Khader Nadakattin | Dharwad, Karnataka | Tamarind seed separator |
| 32 | Abdul Khader Nadakattin | Dharwad, Karnataka | Seed-cum-fertiliser drill, sugarcane driller, wheel tiller |
| 33 | Uddhab Bharali | Lakhimpur, Assam | Pomegranate deseeder |
| 34 | Hariman Sharma | Himachal Pradesh | HRMN-99 warm-climate apple variety |
| 35 | Oinam Ibetombi Devi, Sarangthen Dasumati Devi, Nameirakpam Sanahambi Devi | Nambol, Manipur | Herbal anti-coccidial poultry feed formulation |
| 36 | Ishwar Singh Kundu | Kaithal, Haryana | Multi-utility herbal bio-fertiliser/pest-control formulation |
| 37 | Mansukhbhai Prajapati | Wankaner, Gujarat | Mitticool clay refrigerator (no electricity needed) |

Full facts, problem/solution text, and paragraph templates for each are in
`build_dataset.py`'s `CASES` list — this table is just a locator.

## 7. Quick links back to the deliverables

- Full project zip + individual files: shared in the previous message
  (`grassroots-extraction.zip`, plus `train.jsonl`/`val.jsonl`/`test.jsonl`,
  `README.md`, `SOURCES.md`, `train.py`, `eval.py`, `results.md`)
- `SOURCES.md` inside that zip has the same source table as §4 above,
  mapped one-to-one against each `case_id`.
