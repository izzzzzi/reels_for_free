# Генератор вирусных рилсов

Автоматическая генерация вирусных рилсов с AI-озвучкой, параллакс анимацией и субтитрами.

## Требования

- Node.js 22+
- Python 3.12+
- FFmpeg
- CUDA (опционально, для ускорения генерации изображений)

## Установка

### macOS

```bash
# 1. Установка Homebrew (если еще не установлен)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Установка зависимостей
brew install node pnpm python@3.12 ffmpeg cmake

# 3. Установка Python зависимостей
pip3 install transparent-background

# 4. Сборка stable-diffusion.cpp
git clone --recursive https://github.com/leejet/stable-diffusion.cpp
cd stable-diffusion.cpp
mkdir build && cd build

# Для Mac с GPU (Apple Silicon M1/M2/M3/M4 или AMD):
cmake .. -DSD_METAL=ON
cmake --build . --config Release

# Для Mac с Intel без дискретной GPU:
cmake ..
cmake --build . --config Release

# Копируем бинарник
sudo cp bin/sd /usr/local/bin/sd-z
cd ../..

# 5. Установка зависимостей проекта
pnpm install

# 6. Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env и добавьте свои API ключи
```

### Linux (Ubuntu/Debian)

```bash
# 1. Установка системных зависимостей
sudo apt update
sudo apt install -y curl git build-essential cmake python3 python3-pip ffmpeg

# 2. Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Установка pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# 4. Установка Python зависимостей
pip3 install transparent-background

# 5. Сборка stable-diffusion.cpp
git clone --recursive https://github.com/leejet/stable-diffusion.cpp
cd stable-diffusion.cpp
mkdir build && cd build

# CPU версия:
cmake ..
cmake --build . --config Release

# Или с CUDA (если есть NVIDIA GPU):
cmake .. -DSD_CUDA=ON
cmake --build . --config Release

# Копируем бинарник
sudo cp bin/sd /usr/local/bin/sd-z
cd ../..

# 6. Установка зависимостей проекта
pnpm install

# 7. Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env и добавьте свои API ключи
```

### Windows

```powershell
# 1. Установка Chocolatey (запустите PowerShell от администратора)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 2. Установка зависимостей
choco install -y nodejs python git cmake ffmpeg

# 3. Установка pnpm
npm install -g pnpm

# 4. Установка Python зависимостей
pip install transparent-background

# 5. Сборка stable-diffusion.cpp
git clone --recursive https://github.com/leejet/stable-diffusion.cpp
cd stable-diffusion.cpp
mkdir build
cd build

# Для CPU:
cmake ..
cmake --build . --config Release

# Для NVIDIA GPU (если установлен CUDA Toolkit):
cmake .. -DSD_CUDA=ON
cmake --build . --config Release

# Копируем бинарник (измените путь на свой)
copy bin\Release\sd.exe C:\Windows\System32\sd-z.exe
cd ..\..

# 6. Установка зависимостей проекта
pnpm install

# 7. Настройка переменных окружения
copy .env.example .env
# Отредактируйте .env в любом текстовом редакторе
```

## Настройка

1. **Получите API ключи:**
   - Gemini API: https://makersuite.google.com/app/apikey
   - ElevenLabs API: https://elevenlabs.io/api

2. **Скачайте модели для stable-diffusion с помощью hf CLI:**

   ```bash
   # Установка hf CLI (macOS/Linux)
   curl -LsSf https://hf.co/cli/install.sh | bash

   # Или через pip
   pip3 install -U huggingface_hub

   # Создайте директорию для моделей
   mkdir -p ~/models/sd-z

   # Скачивание моделей
   hf download vantagewithai/Z-Image-Turbo-GGUF z_image_turbo-Q4_1.gguf --local-dir ~/models/sd-z
   hf download Comfy-Org/z_image_turbo split_files/text_encoders/qwen_3_4b.safetensors --local-dir ~/models/sd-z
   hf download second-state/FLUX.1-dev-GGUF ae.safetensors --local-dir ~/models/sd-z

   # Переименование/перемещение файлов
   mv ~/models/sd-z/split_files/text_encoders/qwen_3_4b.safetensors ~/models/sd-z/
   mv ~/models/sd-z/ae.safetensors ~/models/sd-z/ae-f16.gguf
   ```

   Модели:
   - `z_image_turbo-Q4_1.gguf` - основная модель диффузии (Z-Image Turbo)
   - `ae-f16.gguf` - VAE модель (FLUX.1)
   - `qwen_3_4b.safetensors` - текстовый энкодер (Qwen 3 4B)

3. **Отредактируйте `.env`:**

```env
# API ключи
GEMINI_API_KEY=ваш_ключ_gemini
ELEVENLABS_API_KEY=ваш_ключ_elevenlabs

# Путь к моделям SD-Z
SD_Z_COMMAND=sd-z --diffusion-model /путь/к/моделям/z_image_turbo-Q4_1.gguf --vae /путь/к/моделям/ae-f16.gguf --llm /путь/к/моделям/qwen_3_4b.safetensors --cfg-scale 1 --clip-on-cpu --diffusion-fa -H 640 -W 480 --steps 8 --lora-model-dir /путь/к/моделям/
```

4. **Добавьте фоновую музыку:**
   - Положите файл `music.mp3` в корень проекта

## Использование

### Полный пайплайн (одна команда):

```bash
pnpm build-all
```

Это выполнит все шаги:
1. Генерация сценария (Gemini AI)
2. Генерация изображений (Stable Diffusion)
3. Генерация озвучки (ElevenLabs)
4. Рендер видео с параллакс эффектом (Remotion)
5. Добавление субтитров (Whisper)
6. Добавление фоновой музыки (FFmpeg)

### Пошаговое выполнение:

```bash
# 1. Генерация сценария
pnpm generate-scenario

# 2. Генерация изображений
pnpm generate-images

# 3. Генерация озвучки
pnpm generate-speech

# 4. Рендер видео
pnpm render-video

# 5. Добавление субтитров
pnpm add-captions

# 6. Добавление музыки
pnpm add-music
```

### Дополнительные команды:

```bash
# Проверка статуса
pnpm status

# Очистка всех сгенерированных файлов
pnpm clean
```

## Результаты

- `output/scenario.json` - сгенерированный сценарий
- `output/audio/` - аудио файлы озвучки
- `final-video/output/final-reel.mp4` - видео без субтитров
- `captions/output/final-with-subs.mp4` - видео с субтитрами
- `output/final/final-reel.mp4` - **финальное видео с музыкой**

## Настройка генерации

Отредактируйте `src/generate-scenario.ts` для изменения промпта сценария.

Параметры в `.env`:
- Размер изображений: `-H` (высота) и `-W` (ширина)
- Качество: `--steps` (больше = лучше, но медленнее)

## Лицензия

MIT

## Благодарности

- [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)
- [transparent-background](https://github.com/plemeri/transparent-background)
- [Remotion](https://www.remotion.dev/)
- [ElevenLabs](https://elevenlabs.io/)
- [Google Gemini](https://deepmind.google/technologies/gemini/)

