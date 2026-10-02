# Albion Build Maker

Конструктор билдов Albion Online: для каждого слота выбираешь вещь, тир,
зачарование, качество и навыки — и получаешь картинку (PNG), текст для чата
и ссылку, по которой открывается тот же билд.

Build maker for Albion Online: pick items, tier, enchantment, quality and
spells per slot — get a PNG, a text summary and a shareable link.

## Запуск локально

```
python3 -m http.server 8765
```

и открыть http://localhost:8765/.

## Обновить данные после патча

```
npm run fetch   # скачивает свежие ao-bin-dumps, собирает data/ и докачивает новые иконки
                # (node tools/fetch.mjs --cached — собрать из уже скачанных дампов)
npm run quality # пересобрать рамки качества (icons/quality) — нужно, только если в игре поменялся их вид
npm run check   # проверка: у каждой вещи иконка на каждый тир, навыки на месте
npm test
```

Нужны Node 22+ и `cwebp` (`brew install webp`).

## Данные

Вещи, навыки и названия — [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps).
Иконки — render.albiononline.com, © Sandbox Interactive GmbH.
Неофициальный фан-проект, не связан с Sandbox Interactive.
