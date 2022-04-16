import React from "react"
import * as faceapi from "face-api.js"

import "./Sminem.scss"

class Sminem extends React.Component {
  constructor(props) {
    super(props)

    this.canvasRef = React.createRef()
    this.videoRef = React.createRef()

    this.handlePlaying = this.handlePlaying.bind(this)
    this.initializeVideo = this.initializeVideo.bind(this)
    this.startVideo = this.startVideo.bind(this)
    this.updateVideo = this.updateVideo.bind(this)

    this.state = {
      loading: true,
    }
  }

  initializeVideo(stream) {
    const video = this.videoRef.current
    video.srcObject = stream
    video.addEventListener("playing", this.handlePlaying)
  }

  handlePlaying() {
    const video = this.canvasRef.current
    const displaySize = { width: video.width, height: video.height };
    const canvas = this.canvasRef.current

    canvas.innerHTML = faceapi.createCanvasFromMedia(this.videoRef.current)
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(this.updateVideo, 1000)
  }

  startVideo() {
    navigator.mediaDevices.getUserMedia({video: {}})
      .then(stream => this.initializeVideo(stream))
      .catch(err => console.error(err))
  }

  async updateVideo() {
    const video = this.videoRef.current
    const canvas = this.canvasRef.current
    const displaySize = { width: video.width, height: video.height };

    const detections = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender()
    if (detections === undefined) return;

    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);

  }

  componentDidMount() {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      faceapi.nets.ageGenderNet.loadFromUri("/models")
    ]).then(() => this.setState({loading: false}, this.startVideo));
  }

  render() {
    return (
      <div className="Sminem">
        {this.state.loading && <div className="Sminem__loading">Загрузка...</div>}
        {!this.state.loading && <div className="Sminem__video-container">
            <video id="video" style={{display: "flex", justifyContent: "center", padding: "10px"}} width="500" height="500" autoPlay muted ref={this.videoRef}/>
            <canvas ref={this.canvasRef} style={{position: "absolute"}}/>
          </div>
        }
      </div>
    )
  }
}

export default Sminem;