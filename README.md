# Video Cut

A web-based video editing application built with Next.js and MongoDB. This application allows users to upload videos and trim them to specific start and end times.

## Features

- Upload videos
- View uploaded videos
- Trim videos by specifying start and end times
- Client-side video processing using FFmpeg WASM
- Responsive user interface

## Technologies Used

- Next.js 14 (App Router)
- TypeScript
- MongoDB (with Mongoose)
- Tailwind CSS
- FFmpeg WASM for client-side video processing
- Zustand for state management
- Axios for API requests
- React Dropzone for file uploads

## Getting Started

### Prerequisites

- Node.js 18.x or later
- MongoDB (local or remote)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/video-cut.git
cd video-cut
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory with your MongoDB connection string:

```
MONGODB_URI=mongodb://localhost:27017/video-cut
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `src/app`: Next.js pages and API routes
- `src/components`: React components
- `src/lib/db`: Database connection and models
- `src/lib/utils`: Utility functions for video processing
- `src/lib/store`: Zustand stores for state management
- `public/uploads`: Directory for uploaded videos

## API Endpoints

- `GET /api/videos`: Get all videos
- `POST /api/videos`: Upload a new video
- `POST /api/videos/[id]/process`: Process a video (trim)

## License

MIT

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [FFmpeg WASM](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [Tailwind CSS](https://tailwindcss.com/)
- [MongoDB](https://www.mongodb.com/)
