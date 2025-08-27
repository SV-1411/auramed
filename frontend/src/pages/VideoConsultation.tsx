import React from 'react';
import { useParams } from 'react-router-dom';

const VideoConsultation: React.FC = () => {
  const { roomId } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Video Consultation</h1>
      <p className="text-gray-600">Placeholder for video room: {roomId}</p>
    </div>
  );
};

export default VideoConsultation;
