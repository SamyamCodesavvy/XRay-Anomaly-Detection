import { useRef, useEffect, useState } from "react";
import path from "path-browserify";

const XRayAnalyzer = () => {
  const [previousScans, setPreviousScans] = useState([]);
  const [image, setImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const inputRef = useRef(null);
  const [cardClicked, setCardClicked] = useState(false);
  const [detectClicked, setDetectClicked] = useState(false);
  const [saveClicked, setSaveClicked] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3000')
      .then(response => response.json())
      .then(data => setPreviousScans(data))
      .catch(error => console.error('Error fetching image paths:', error));
  }, []);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData,
      })
        .then(response => response.json())
        .then(data => {
          setImage(data.imageUrl);
          setProcessedImage(null);
          setCardClicked(false);
          setDetectClicked(false);
          setSaveClicked(true);
          setAnomalies([]);
        })
        .catch(error => console.error('Error uploading image:', error));
    }
  };

  const detectAnomalies = () => {
    fetch('http://localhost:3000/detect', {
      method: 'POST',
      headers: {upl
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl: image }),
    })
      .then(response => response.json())
      .then(data => {
        setProcessedImage(data.processedImageUrl);
        setAnomalies(data.anomalies);
        setCardClicked(true);
        setDetectClicked(true);
        setSaveClicked(false);
      })
      .catch(error => console.error('Error detecting anomalies:', error));
  };

  const saveDetails = () => {
    if (!saveClicked && processedImage) {
      fetch('http://localhost:3000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: processedImage,
          anomalies: anomalies,
        }),
      })
        .then(response => response.text())
        .then(data => {
          console.log(data);
          setSaveClicked(true);
          fetch('http://localhost:3000')
            .then(response => response.json())
            .then(data => setPreviousScans(data))
            .catch(error => console.error('Error refetching image paths:', error));
        })
        .catch(error => console.error('Error saving image:', error));
    }
  };

  const handleCardClick = (scan) => {
    setImage(scan.imageUrl);
    setProcessedImage(null);
    setCardClicked(true);
    setSaveClicked(true);
    setDetectClicked(false);
    setAnomalies(scan.anomalies || []);
  };

  return (
    <div className="xray-container">
      <div className="left-panel">
        <h1>Previous Scans</h1>
        <div className="scan-list">
          {previousScans.map((scan, index) => (
            <div key={index} className="scan-card" onClick={() => handleCardClick(scan)}>
              {scan.imageUrl && path.basename(scan.imageUrl)}
            </div>
          ))}
        </div>
      </div>
      <div className="center-panel">
        <input type="file" accept="image/*" ref={inputRef} onChange={handleImageUpload} hidden />
        {!image && (
          <button className="upload-btn" onClick={() => inputRef.current.click()}>
            Upload X-ray
          </button>
        )}
        {(image || processedImage) && (
          <>
            <div className="upload-area">
              <img src={processedImage || image} alt="X-ray Image" className="xray-image" />
            </div>
            <div className="button-group">
              <button className="upload-btn" onClick={() => inputRef.current.click()}>
                Upload
              </button>
              {!cardClicked && (
                <button className="detect-btn" onClick={detectAnomalies}>
                  Detect
                </button>
              )}
              {detectClicked && (
                <button className="save-btn" onClick={saveDetails}>
                  {saveClicked ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <div className="right-panel">
        <div className="project_name">X-RAY ANOMALY DETECTION</div>
        <h1>Detection Results</h1>
        {anomalies.length > 0 ? (
          <div className="results">
            {anomalies.map((a, index) => (
              <h2 key={index}>{a.anomalyName}: {a.percentage}</h2>
            ))}
          </div>
        ) : <h2>No anomalies detected</h2>}
      </div>
    </div>
  );
};

export default XRayAnalyzer;