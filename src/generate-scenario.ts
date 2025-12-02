#!/usr/bin/env tsx

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

interface Slide {
  type: string;
  text_to_tts: string;
  z_image_prompt: string;
}

interface Scenario {
  slides: Slide[];
}

interface GenerationState {
  scenario?: Scenario;
  slides: any[];
  completed: boolean;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SCENARIO_THEME = process.env.SCENARIO_THEME || 'SCP в постсоветской тематике с аналоговым хоррором';
const OUTPUT_DIR = './output';
const STATE_FILE = path.join(OUTPUT_DIR, 'state.json');

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // ignore
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadState(): Promise<GenerationState> {
  if (await fileExists(STATE_FILE)) {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  }
  return {
    slides: [],
    completed: false
  };
}

async function saveState(state: GenerationState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function generateScenario(): Promise<Scenario> {
  console.log('Генерация нового сценария через Gemini...');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `сделай сценарий для вирусного рилса

  тема: ${SCENARIO_THEME}

надо на 25 секунд и на 5 слайдов (по 5 секунд на слайд)

Начинай с хука который мгновенно захватит внимание. 
Первый слайд должен выглядеть как какой-то подозрительный объект на фоне постсоветской реальности с текстом над ним чтобы выглядело кликбейтно

ВАЖНО про промпты для изображений:
- Изображения будут обрабатываться через AI который ОТДЕЛИТ ГЛАВНЫЙ ОБЪЕКТ ОТ ФОНА
- Каждое изображение должно иметь ОДИН ЧЕТКИЙ ГЛАВНЫЙ ОБЪЕКТ (человек, предмет, символ) который можно легко отделить от фона
- НЕ создавай сложные композиции с множеством элементов
- Главный объект должен быть в центре или чуть выше центра
- Фон должен быть отличим от объекта (не сливаться)

ВАЖНО про текст на изображениях:
- ТОЛЬКО на ПЕРВОМ слайде (hook) добавь текст СВЕРХУ изображения
- На остальных слайдах (2-5) НЕ ДОЛЖНО БЫТЬ НИКАКОГО ТЕКСТА на изображении
- Текст озвучки будет добавлен отдельно

вот тебе пример правильного промпта:
cinematic photograph of a solitary hooded hacker figure, centered, dramatic lighting from behind creating a silhouette effect. The figure stands out clearly against a dark blurred background with subtle blue digital elements. Clear separation between subject and background. Superimposed at the TOP of the image in a bold, glitched font: 'КТО ОН?' -- moody, atmospheric, dark, cinematic

пример БЕЗ текста для слайдов 2-5:
dramatic close-up portrait of a mysterious figure in shadow, one hand holding a vintage phone glowing with ethereal light. The figure is the clear focal point, well-defined against a softly blurred background of abstract digital patterns. -- enigmatic, cinematic, atmospheric

язык русский для text_to_tts
язык английский для z_image_prompt

отдай в формате json:
{
  "slides": [{
    "type": "hook",
    "text_to_tts": "текст на русском для озвучки",
    "z_image_prompt": "english prompt with text ONLY for first slide"
  }]
}

никаких лишних данных возвращай только json`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Извлекаем JSON из ответа (убираем markdown форматирование если есть)
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '');
  }

  const scenario: Scenario = JSON.parse(jsonText);
  console.log(`Сценарий сгенерирован: ${scenario.slides.length} слайдов`);

  return scenario;
}

async function main() {
  console.log('Генерация сценария...');
  console.log(`Тема: ${SCENARIO_THEME}\n`);

  if (!GEMINI_API_KEY) {
    console.error('Не указан GEMINI_API_KEY');
    console.error('Установите переменную окружения: export GEMINI_API_KEY=your_api_key');
    process.exit(1);
  }

  // Создаем необходимые директории
  await ensureDir(OUTPUT_DIR);

  try {
    // Загружаем состояние
    const state = await loadState();

    if (state.scenario) {
      console.log('Сценарий уже существует!');
      console.log('Текущий сценарий:');
      state.scenario.slides.forEach((slide, i) => {
        console.log(`  ${i + 1}. [${slide.type}] ${slide.text_to_tts.substring(0, 60)}...`);
      });
      console.log('\nЧтобы сгенерировать новый сценарий, удалите файл: output/state.json');
      console.log('   Или запустите: pnpm clean');
      return;
    }

    // Генерируем сценарий
    const scenario = await generateScenario();

    // Сохраняем сценарий в state
    state.scenario = scenario;
    state.completed = false; // Сбрасываем флаг завершения
    await saveState(state);

    // Сохраняем сценарий в отдельный файл для удобства просмотра
    const scenarioPath = path.join(OUTPUT_DIR, 'scenario.json');
    await fs.writeFile(scenarioPath, JSON.stringify(scenario, null, 2));

    console.log('\nСценарий сохранен!');
    console.log(`Файлы:`);
    console.log(`   - output/scenario.json (для просмотра)`);
    console.log(`   - output/state.json (рабочее состояние)`);
    console.log('\nСодержание:');
    scenario.slides.forEach((slide, i) => {
      console.log(`  ${i + 1}. [${slide.type}] ${slide.text_to_tts}`);
    });
    console.log('\nСледующий шаг: pnpm generate-images');

  } catch (error) {
    console.error('\nОшибка:', error);
    process.exit(1);
  }
}

main();

