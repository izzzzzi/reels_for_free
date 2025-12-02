#!/usr/bin/env tsx

import 'dotenv/config';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { EdgeTTS } from '@travisvn/edge-tts';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';

const execAsync = promisify(exec);

// TTS Engine config
const TTS_ENGINE = process.env.TTS_ENGINE || 'edge'; // 'edge' | 'elevenlabs'
const TTS_VOICE = process.env.TTS_VOICE || 'ru-RU-DmitryNeural';

interface Slide {
  type: string;
  text_to_tts: string;
  z_image_prompt: string;
}

interface Scenario {
  slides: Slide[];
}

interface SlideMetadata {
  index: number;
  type: string;
  text_to_tts: string;
  z_image_prompt: string;
  original_image: string;
  object_image: string;
  background_image: string;
  pivot: {
    x: number;
    y: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  audio_path?: string;
  duration?: number;
  completed: boolean;
}

interface RemotionData {
  slides: SlideMetadata[];
  totalDuration: number;
  slideDuration: number;
  fps: number;
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const OUTPUT_DIR = './output';
const AUDIO_DIR = path.join(OUTPUT_DIR, 'audio');
const STATE_FILE = path.join(OUTPUT_DIR, 'state.json');
const REMOTION_DATA_FILE = path.join(OUTPUT_DIR, 'remotion-data.json');
const FPS = 30;

// Энергичный мужской голос для рилсов
const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George - глубокий уверенный мужской голос

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

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );
    return parseFloat(stdout.trim());
  } catch (error) {
    console.error('Ошибка получения длительности аудио:', error);
    throw error;
  }
}

async function generateSpeechElevenLabs(text: string, outputPath: string): Promise<void> {
  const client = new ElevenLabsClient({
    apiKey: ELEVENLABS_API_KEY,
  });

  const audio = await client.textToSpeech.convert(VOICE_ID, {
    text,
    modelId: 'eleven_turbo_v2_5', // Быстрая модель с поддержкой русского
    voiceSettings: {
      stability: 0.4, // Пониженная стабильность для более динамичной речи
      similarityBoost: 0.8, // Высокое сходство с голосом
      style: 0.7, // Повышенная экспрессивность для рилсов
      useSpeakerBoost: true, // Улучшение качества голоса
    },
  });

  // Сохраняем аудио
  const chunks: Uint8Array[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
  await fs.writeFile(outputPath, audioBuffer);
}

async function generateSpeechEdge(text: string, outputPath: string): Promise<void> {
  const tts = new EdgeTTS(text, TTS_VOICE);
  const result = await tts.synthesize();
  const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
  await fs.writeFile(outputPath, audioBuffer);
}

async function generateSpeech(text: string, outputPath: string): Promise<void> {
  console.log(`Генерация озвучки (${TTS_ENGINE})...`);
  console.log(`Текст: ${text.substring(0, 50)}...`);

  try {
    if (TTS_ENGINE === 'elevenlabs') {
      await generateSpeechElevenLabs(text, outputPath);
    } else {
      await generateSpeechEdge(text, outputPath);
    }
    console.log(`Аудио сохранено: ${outputPath}`);
  } catch (error) {
    console.error('Ошибка генерации речи:', error);
    throw error;
  }
}

async function main() {
  console.log('Запуск генерации озвучки...\n');
  console.log(`Движок: ${TTS_ENGINE}, голос: ${TTS_ENGINE === 'edge' ? TTS_VOICE : VOICE_ID}\n`);

  if (TTS_ENGINE === 'elevenlabs' && !ELEVENLABS_API_KEY) {
    console.error('Не указан ELEVENLABS_API_KEY');
    console.error('Установите переменную окружения: export ELEVENLABS_API_KEY=your_api_key');
    console.error('Или используйте edge-tts: export TTS_ENGINE=edge');
    process.exit(1);
  }

  // Создаем директорию для аудио
  await ensureDir(AUDIO_DIR);

  // Проверяем наличие state.json
  if (!await fileExists(STATE_FILE)) {
    console.error('Файл state.json не найден');
    console.error('Сначала запустите: pnpm generate');
    process.exit(1);
  }

  // Читаем state
  const stateContent = await fs.readFile(STATE_FILE, 'utf-8');
  const state = JSON.parse(stateContent);

  if (!state.scenario) {
    console.error('Сценарий не найден в state.json');
    console.error('Сначала запустите: pnpm generate');
    process.exit(1);
  }

  const scenario: Scenario = state.scenario;
  const updatedSlides: SlideMetadata[] = [];

  // Генерируем озвучку для каждого слайда
  for (let i = 0; i < scenario.slides.length; i++) {
    const slide = scenario.slides[i];
    const slideData = state.slides[i];

    if (!slideData) {
      console.error(`Данные слайда ${i} не найдены`);
      continue;
    }

    console.log(`\nОбработка слайда ${i + 1}/${scenario.slides.length}`);

    const audioPath = path.join(AUDIO_DIR, `slide_${i}.mp3`);
    const relativeAudioPath = path.relative(OUTPUT_DIR, audioPath);

    // Проверяем, есть ли уже аудио
    if (await fileExists(audioPath)) {
      console.log('Аудио уже существует');
    } else {
      // Генерируем озвучку
      await generateSpeech(slide.text_to_tts, audioPath);
    }

    // Получаем длительность аудио
    const duration = await getAudioDuration(audioPath);
    console.log(`Длительность: ${duration.toFixed(2)} сек`);

    // Обновляем метаданные слайда
    updatedSlides.push({
      ...slideData,
      audio_path: relativeAudioPath,
      duration: duration,
    });
  }

  // Вычисляем общую длительность
  const totalDuration = updatedSlides.reduce((sum, slide) => sum + (slide.duration || 0), 0);

  // Создаем финальный JSON для Remotion
  const remotionData: RemotionData = {
    slides: updatedSlides,
    totalDuration,
    slideDuration: totalDuration / updatedSlides.length, // Средняя длительность
    fps: FPS,
  };

  await fs.writeFile(REMOTION_DATA_FILE, JSON.stringify(remotionData, null, 2));

  console.log('\nГенерация озвучки завершена!');
  console.log(`Общая длительность: ${totalDuration.toFixed(2)} сек`);
  console.log(`Данные сохранены в: ${REMOTION_DATA_FILE}`);
  console.log('\nТеперь используй эти данные в Remotion');
  console.log('   cd final-video && pnpm sync && pnpm dev');
}

main();

