#!/usr/bin/env tsx

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const execAsync = promisify(exec);

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
    completed: boolean;
}

interface GenerationState {
    scenario?: Scenario;
    slides: SlideMetadata[];
    completed: boolean;
}

interface RemotionData {
    slides: SlideMetadata[];
    totalDuration: number;
    slideDuration: number;
    fps: number;
}

const OUTPUT_DIR = './output';
const TEMP_DIR = './temp';
const SLIDE_DURATION = 5;
const FPS = 30;
const STATE_FILE = path.join(OUTPUT_DIR, 'state.json');
const REMOTION_DATA_FILE = path.join(OUTPUT_DIR, 'remotion-data.json');

// SD-Z команда из .env (без промпта и output, они подставляются динамически)
const SD_Z_COMMAND = process.env.SD_Z_COMMAND || 'sd-z --diffusion-model /Users/admin/projects/ai/zimage/z_image_turbo-Q4_1.gguf --vae /Users/admin/projects/ai/zimage/ae-f16.gguf --llm /Users/admin/projects/ai/zimage/qwen_3_4b.safetensors --cfg-scale 1 --clip-on-cpu --diffusion-fa -H 640 -W 480 --steps 8 --lora-model-dir /Users/admin/projects/ai/zimage/';

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

async function generateImage(prompt: string, outputPath: string): Promise<void> {
    console.log(`🎨 Генерация изображения...`);

    const cmd = `${SD_Z_COMMAND} -p "${prompt}" -o "${outputPath}"`;

    try {
        await execAsync(cmd);
        console.log(`✅ Изображение сгенерировано: ${outputPath}`);
    } catch (error) {
        console.error(`❌ Ошибка генерации изображения:`, error);
        throw error;
    }
}

async function separateBackgroundAndObject(imagePath: string, outputDir: string): Promise<{ object: string; background: string }> {
    console.log(`🔪 Отделение фона от объекта...`);

    const objectDestDir = path.join(outputDir, 'object_output');
    const backgroundDestDir = path.join(outputDir, 'background_output');

    await execAsync(`transparent-background --source "${imagePath}" --dest "${objectDestDir}"`);
    await execAsync(`transparent-background --source "${imagePath}" --reverse --threshold=0.1 --dest "${backgroundDestDir}"`);

    console.log(`✅ Разделение завершено`);

    const objectPath = path.join(objectDestDir, 'original_rgba.png');
    const backgroundPath = path.join(backgroundDestDir, 'original_rgba_reverse.png');

    return { object: objectPath, background: backgroundPath };
}

async function findObjectCenter(imagePath: string): Promise<{ x: number; y: number; width: number; height: number }> {
    console.log(`📍 Поиск центра объекта...`);

    const image = sharp(imagePath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * info.channels;
            const alpha = info.channels === 4 ? data[idx + 3] : 255;

            if (alpha > 10) {
                hasPixels = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (!hasPixels) {
        return { x: info.width / 2, y: info.height / 2, width: info.width, height: info.height };
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    console.log(`✅ Центр найден: x=${centerX.toFixed(0)}, y=${centerY.toFixed(0)}`);

    return { x: centerX, y: centerY, width: info.width, height: info.height };
}

async function processSlide(
    slide: Slide,
    index: number,
    slideDir: string,
    state: GenerationState
): Promise<SlideMetadata> {
    const slideState = state.slides.find(s => s.index === index);
    if (slideState?.completed) {
        console.log(`\n⏭️  Слайд ${index + 1} уже обработан, пропускаем`);
        return slideState;
    }

    console.log(`\n🎬 Обработка слайда ${index + 1}...`);
    console.log(`📝 Текст: ${slide.text_to_tts.substring(0, 50)}...`);

    const imagePath = path.join(slideDir, 'original.png');

    if (!await fileExists(imagePath)) {
        await generateImage(slide.z_image_prompt, imagePath);
    } else {
        console.log('⏭️  Изображение уже существует');
    }

    const objectPath = path.join(slideDir, 'object_output', 'original_rgba.png');
    const backgroundPath = path.join(slideDir, 'background_output', 'original_rgba_reverse.png');

    let object: string, background: string;
    if (!await fileExists(objectPath) || !await fileExists(backgroundPath)) {
        const result = await separateBackgroundAndObject(imagePath, slideDir);
        object = result.object;
        background = result.background;
    } else {
        console.log('⏭️  Разделение на фон и объект уже выполнено');
        object = objectPath;
        background = backgroundPath;
    }

    const centerData = await findObjectCenter(object);

    console.log(`✅ Слайд ${index + 1} готов`);

    const metadata: SlideMetadata = {
        index,
        type: slide.type,
        text_to_tts: slide.text_to_tts,
        z_image_prompt: slide.z_image_prompt,
        original_image: path.relative(OUTPUT_DIR, imagePath),
        object_image: path.relative(OUTPUT_DIR, object),
        background_image: path.relative(OUTPUT_DIR, background),
        pivot: {
            x: centerData.x,
            y: centerData.y
        },
        dimensions: {
            width: centerData.width,
            height: centerData.height
        },
        completed: true
    };

    const existingSlideIndex = state.slides.findIndex(s => s.index === index);
    if (existingSlideIndex >= 0) {
        state.slides[existingSlideIndex] = metadata;
    } else {
        state.slides.push(metadata);
    }

    await saveState(state);

    return metadata;
}

async function main() {
    console.log('🚀 Генерация изображений...\n');

    await ensureDir(OUTPUT_DIR);
    await ensureDir(TEMP_DIR);

    try {
        const state = await loadState();

        if (!state.scenario) {
            console.error('❌ Сценарий не найден!');
            console.error('Сначала запустите: pnpm generate-scenario');
            process.exit(1);
        }

        if (state.completed) {
            console.log('✅ Изображения уже сгенерированы!');
            console.log(`📁 Данные для Remotion: ${REMOTION_DATA_FILE}`);
            return;
        }

        const scenario = state.scenario;
        const slidesMetadata: SlideMetadata[] = [];

        for (let i = 0; i < scenario.slides.length; i++) {
            const slide = scenario.slides[i];
            const slideDir = path.join(TEMP_DIR, `slide_${i}`);
            await ensureDir(slideDir);

            const metadata = await processSlide(slide, i, slideDir, state);
            slidesMetadata.push(metadata);
        }

        const remotionData: RemotionData = {
            slides: slidesMetadata,
            totalDuration: scenario.slides.length * SLIDE_DURATION,
            slideDuration: SLIDE_DURATION,
            fps: FPS
        };

        await fs.writeFile(REMOTION_DATA_FILE, JSON.stringify(remotionData, null, 2));

        state.completed = true;
        await saveState(state);

        console.log('\n🎉 Изображения сгенерированы!');
        console.log(`📁 Данные для Remotion: ${REMOTION_DATA_FILE}`);
        console.log(`\n💡 Следующий шаг: pnpm generate-speech`);

    } catch (error) {
        console.error('\n❌ Ошибка:', error);
        process.exit(1);
    }
}

main();

