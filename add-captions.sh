#!/bin/bash

set -e

echo "Добавление субтитров к финальному видео..."

# Проверяем наличие финального видео
if [ ! -f "final-video/output/final-reel.mp4" ]; then
    echo "Ошибка: Финальное видео не найдено: final-video/output/final-reel.mp4"
    echo "Сначала запустите: cd final-video && pnpm render"
    exit 1
fi

# Создаем директорию в captions/public если её нет
mkdir -p captions/public/video

# Удаляем старые субтитры если они есть
if [ -f "captions/public/video/final-reel.json" ]; then
    echo "Удаление старых субтитров..."
    rm captions/public/video/final-reel.json
fi

# Копируем финальное видео
echo "Копирование видео..."
cp final-video/output/final-reel.mp4 captions/public/video/

# Переходим в captions
cd captions

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "Установка зависимостей..."
    pnpm i
fi

# Создаем субтитры через whisper
echo "Генерация субтитров..."
pnpm create-subtitles public/video/final-reel.mp4

echo "Субтитры созданы!"
echo "Файл субтитров: captions/public/video/final-reel.json"
echo ""

# Создаем директорию для вывода если её нет
mkdir -p output

# Рендерим финальное видео с субтитрами
echo "Рендеринг финального видео с субтитрами..."
pnpm exec remotion render CaptionedVideo output/final-with-subs.mp4

echo ""
echo "Готово!"
echo "Финальное видео с субтитрами: captions/output/final-with-subs.mp4"
echo ""
echo "Чтобы посмотреть в Remotion Studio:"
echo "   cd captions && pnpm dev"
