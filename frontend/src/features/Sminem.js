import React from "react"
import * as faceapi from "face-api.js"

import "./Sminem.scss"

class Sminem extends React.Component {
  constructor(props) {
    super(props)

    this.canvasRef = React.createRef()
    this.cropCanvasRef = React.createRef()
    this.videoRef = React.createRef()

    this.handlePlaying = this.handlePlaying.bind(this)
    this.initializeVideo = this.initializeVideo.bind(this)
    this.startVideo = this.startVideo.bind(this)
    this.updateVideo = this.updateVideo.bind(this)
    this.handleCanvasClick = this.handleCanvasClick.bind(this)
    this.handleServerMessage = this.handleServerMessage.bind(this)

    this.playing = false
    this.socket = null

    this.state = {
      loading: true,
      selectedPerson: null,
      persons: []
    }
  }

  initializeVideo(stream) {
    const video = this.videoRef.current
    video.srcObject = stream
    video.addEventListener("playing", this.handlePlaying)
  }

  handleCanvasClick(canvas, event) {
    const video = this.videoRef.current
    const displaySize = { width: video.offsetWidth, height: video.offsetHeight }
    const videoSize = { width: video.videoWidth, height: video.videoHeight }
    const x = event.offsetX
    const y = event.offsetY

    for (let i = 0; i < this.state.persons.length; i++) {
      let person = this.state.persons[i]
      if (!person.isActive) continue
      const scaledBox = this.rescaleBox(person.box, videoSize, displaySize)
      if (x < scaledBox.x || x > scaledBox.x + scaledBox.width) continue
      if (y < scaledBox.y || y > scaledBox.y + scaledBox.height) continue
      this.setState({selectedPerson: i})
      break
    }
  }

  handlePlaying() {
    if (this.playing) return
    this.playing = true
    const video = this.videoRef.current
    const displaySize = { width: video.offsetWidth, height: video.offsetHeight };

    const canvas = faceapi.createCanvasFromMedia(video)
    canvas.style = "position: absolute;"
    canvas.onclick = event => this.handleCanvasClick(canvas, event)

    let container = document.querySelector(".Sminem__video-container");
    container.append(canvas);

    faceapi.matchDimensions(canvas, displaySize);

    setInterval(() => this.updateVideo(canvas, video), 100)
  }

  startVideo() {
    navigator.mediaDevices.getUserMedia({video: {}})
      .then(stream => this.initializeVideo(stream))
      .catch(err => console.error(err))
  }

  generateName() {
    let firstNames = ["A.", "B.", "C.", "D."]
    let lastNames = ["E.", "F.", "G.", "H."]

    let firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    let lastName = lastNames[Math.floor(Math.random() * lastNames.length)]

    return `${firstName} ${lastName}`
  }

  rescaleBox(box, originalSize, newSize) {
    let xScalingFactor = newSize.width / originalSize.width
    let yScalingFactor = newSize.height / originalSize.height

    return new faceapi.Box({
      x: box.x * xScalingFactor,
      y: box.y * yScalingFactor,
      width: box.width * xScalingFactor,
      height: box.height * yScalingFactor,
    })
  }

  getEmotion(expressions) {
    const maxValue = Math.max(...Object.values(expressions));
    return Object.keys(expressions).filter(
      item => expressions[item] === maxValue
    )[0]
  }

  async updateVideo(canvas, video) {
    // const video = this.videoRef.current
    const displaySize = { width: video.offsetWidth, height: video.offsetHeight }
    const videoSize = { width: video.videoWidth, height: video.videoHeight }

    const hiddenCanvas = this.canvasRef.current
    if (hiddenCanvas) {
      hiddenCanvas.height = videoSize.height
      hiddenCanvas.width = videoSize.width
      const hiddenCanvasCtx = hiddenCanvas.getContext("2d")
      hiddenCanvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors()
      //.withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender()

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    if (detections.length === 0) return;

    const persons = [...this.state.persons]

    for (const person of persons) {
      person.isActive = false
    }

    if (persons.length === 0 ) {
      for (const detection of detections) {
        persons.push({
          name: this.generateName(),
          descriptor: detection.descriptor,
          box: detection.detection.box,
          appearances: 1,
          isActive: true,
          features: {
            age: [detection.age],
            gender: detection.gender,
            expressions: detection.expressions
          }
        })
      }
    } else {
      const faceMatcher = new faceapi.FaceMatcher(
        persons.map((e, i) => new faceapi.LabeledFaceDescriptors(i.toString(), [e.descriptor]))
      )

      for (const detection of detections) {
        const best = faceMatcher.findBestMatch(detection.descriptor)
        let id, person
        if (best.label === "unknown") {
          id = persons.length
          person = {
            name: this.generateName(),
            descriptor: detection.descriptor,
            box: detection.detection.box,
            isActive: true,
            features: {
              age: [detection.age],
              gender: detection.gender,
              expressions: detection.expressions
            }
          }
          persons.push(person)
        } else {
          id = parseInt(best.label)
          person = persons[id]
          person.box = detection.detection.box
          person.isActive = true
          person.appearances = (person.appearances + 1) % 60
          person.features = {
            ...person.features,
            age: [detection.age, ...person.features.age.slice(0, 19)],
            gender: detection.gender,
            expressions: detection.expressions,
          }
        }

        if (person.appearances % 10 === 0) {
          const cropCanvas = this.cropCanvasRef.current
          const detectionBox = detection.detection.box
          cropCanvas.height = detectionBox.height
          cropCanvas.width = detectionBox.width
          const cropCanvasCtx = cropCanvas.getContext("2d")
          cropCanvasCtx.drawImage(
            hiddenCanvas, detectionBox.x, detectionBox.y, detectionBox.width, detectionBox.height,
            0, 0, cropCanvas.width, cropCanvas.height
          );
          const b64Data = cropCanvas.toDataURL().split(",", 2)[1]
          if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
              person_id: id,
              img: b64Data
            }))
          }
        }

        const drawBox = new faceapi.draw.DrawBox(
          this.rescaleBox(detection.detection.box, videoSize, displaySize), {
          label: `${person.name} (${id})`,
          lineWidth: 2,
          boxColor: id === this.state.selectedPerson ? "rgb(84,213,90)" : "rgb(68, 238, 170)"
        })

        drawBox.draw(canvas)
      }
    }

    this.setState({persons: persons})
  }

  handleServerMessage(event) {
    const {person_id, result} = JSON.parse(event.data)
    const persons = [...this.state.persons]
    if (person_id > persons.length || person_id < 0) {
      console.log("Bad event", event)
      return
    }

    const person = persons[person_id]
    for (const detection in result) {
      person.features[detection.attribute_name] = detection.data
    }
  }

  componentDidMount() {
    this.socket = new WebSocket("ws://javascript.info");
    this.socket.onmessage = this.handleServerMessage
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      faceapi.nets.ageGenderNet.loadFromUri("/models")
    ]).then(() => this.setState({loading: false}, this.startVideo));
  }

  getMeanAge(ages) {
    return ages.reduce((a, b) => a + b) / ages.length
  }

  render() {
    let person = null
    if (this.state.selectedPerson !== null) {
      person = this.state.persons[this.state.selectedPerson]
    }

    return (
      <div className="Sminem">
        <canvas className="Sminem__capture-canvas" ref={this.canvasRef}/>
        <canvas className="Sminem__crop-canvas" ref={this.cropCanvasRef}/>
        {this.state.loading && <div className="Sminem__loading">Загрузка...</div>}
        {!this.state.loading && <div className="Sminem__content">
          <div className="Sminem__video-container">
            <video id="video" className="Sminem__video" autoPlay muted ref={this.videoRef}/>
          </div>
          {person !== null && <div className="Sminem__description">
              <div className="Sminem__control-buttons">
                <div className="Sminem__navigator">
                  <div
                    className="Sminem__button"
                    onClick={
                      () => this.setState({
                       selectedPerson: this.state.selectedPerson === 0 ?
                        this.state.persons.length - 1 : (this.state.selectedPerson - 1) % this.state.persons.length
                      })
                    }
                  >
                    Prev.
                  </div>
                  <div
                    className="Sminem__button"
                    onClick={
                      () => this.setState({
                        selectedPerson: (this.state.selectedPerson + 1) % this.state.persons.length
                      })
                    }
                  >
                    Next
                  </div>
                </div>
              </div>
              <div className="Sminem__person-data">
                ID: {this.state.selectedPerson}<br/>
                Name: {person.name}<br/>
                Gender: {person.features.gender}<br/>
                Age: {Math.round(this.getMeanAge(person.features.age))}<br/>
                Mood: {this.getEmotion(person.features.expressions)}<br/>
              </div>
              <div
                className="Sminem__button"
                style={{marginTop: 10}}
                onClick={() => navigator.clipboard.writeText(JSON.stringify(person.features))}
              >
                Copy JSON
              </div>
            </div>
          }
         </div>
        }
      </div>
    )
  }
}

export default Sminem;