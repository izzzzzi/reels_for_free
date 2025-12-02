#!/usr/bin/env tsx

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

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
  completed: boolean;
}

interface GenerationState {
  scenario?: {
    slides: Array<{
      type: string;
      text_to_tts: string;
      z_image_prompt: string;
    }>;
  };
  slides: SlideMetadata[];
  completed: boolean;
}

const OUTPUT_DIR = './output';
const STATE_FILE = path.join(OUTPUT_DIR, 'state.json');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Статус подготовки материалов\n');

  if (!await fileExists(STATE_FILE)) {
    console.log('Подготовка еще не начиналась');
    console.log('\nЗапустите: pnpm generate');
    return;
  }

  const content = await fs.readFile(STATE_FILE, 'utf-8');
  const state: GenerationState = JSON.parse(content);

  if (state.completed) {
    console.log('Подготовка материалов завершена!');
    console.log(`Данные для Remotion: output/remotion-data.json`);
    console.log('\nИспользуй remotion-data.json для создания финального видео');
    return;
  }

  console.log('Подготовка в процессе...\n');

  if (state.scenario) {
    console.log(`Сценарий: ${state.scenario.slides.length} слайдов`);
  } else {
    console.log('Сценарий: еще не сгенерирован');
  }

  console.log('\nСлайды:');
  if (state.scenario) {
    for (let i = 0; i < state.scenario.slides.length; i++) {
      const slideState = state.slides.find(s => s.index === i);
      const status = slideState?.completed ? '[OK]' : '[...]';
      const slide = state.scenario.slides[i];
      const preview = slide.text_to_tts.substring(0, 40);
      console.log(`  ${status} Слайд ${i + 1}: ${preview}...`);
      if (slideState?.completed) {
        console.log(`     Pivot: (${slideState.pivot.x.toFixed(0)}, ${slideState.pivot.y.toFixed(0)})`);
        console.log(`     Размер: ${slideState.dimensions.width}x${slideState.dimensions.height}`);
      }
    }
  }

  console.log('\nЗапустите `pnpm generate` чтобы продолжить');
}

main();

