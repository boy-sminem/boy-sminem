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

    this.playing = false
    this.persons = []

    this.state = {
      loading: true,
      selectedPerson: null
    }
  }

  initializeVideo(stream) {
    const video = this.videoRef.current
    video.srcObject = stream
    video.addEventListener("playing", this.handlePlaying)
  }

  handlePlaying() {
    if (this.playing) return
    this.playing = true
    const video = this.videoRef.current
    const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
    // const canvas = this.canvasRef.current

    const canvas = faceapi.createCanvasFromMedia(video)
    canvas.style = "position: absolute;"
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
    let firstNames = ["Lord", "Boy"]
    let lastNames = ["Bogdanoff", "Sminem"]

    let firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    let lastName = lastNames[Math.floor(Math.random() * lastNames.length)]

    return `${firstName} ${lastName}`
  }

  async updateVideo(canvas, video) {
    // const video = this.videoRef.current
    const displaySize = { width: video.offsetWidth, height: video.offsetHeight }

    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors()
      //.withFaceLandmarks()
      //.withFaceExpressions()
      //.withAgeAndGender()

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    if (detections.length === 0) return;
    // if (this.persons.length === 0) {
    //   this.persons.push({
    //     name: "sminem",
    //     descriptor: detections[0].descriptor
    //   })
    // }
    // for (const detection of detections) {
    //   let person = null
    //   for (const p of this.persons) {
    //     const distance = faceMatcher.computeMeanDistance(detection.descriptor, [p.descriptor])
    //     if (distance < 0.6) {
    //       person = p
    //       console.log(`I see person ${p.name}!`)
    //       break
    //     }
    //   }
    //
    //   if (person === null) {
    //     console.log(`I see a new person ${this.persons.length}!`)
    //     this.persons.push({
    //       name: this.persons.length,
    //       descriptor: detection.descriptor,
    //     })
    //   }
    // }

    if (this.persons.length === 0 ) {
      for (const detection of detections) {
        this.persons.push({
          name: this.generateName(),
          descriptor: detection.descriptor,
        })
      }
    } else {
      const faceMatcher = new faceapi.FaceMatcher(
        this.persons.map((e, i) => new faceapi.LabeledFaceDescriptors(i.toString(), [e.descriptor]))
      )

      for (const detection of detections) {
        const best = faceMatcher.findBestMatch(detection.descriptor)
        let id, person
        if (best.label === "unknown") {
          id = this.persons.length
          person = {
            name: this.generateName(),
            descriptor: detection.descriptor,
          }
          this.persons.push(person)
        } else {
          id = parseInt(best.label)
          person = this.persons[id]
        }

        const drawBox = new faceapi.draw.DrawBox(detection.detection.box, {
          label: `${person.name} (${id})`,
          lineWidth: 2,
          boxColor: "rgb(68, 238, 170)"
        })

        drawBox.draw(canvas)
      }
    }

    //console.log(detections)
  }

  componentDidMount() {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      // faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      //faceapi.nets.ageGenderNet.loadFromUri("/models")


    ]).then(() => this.setState({loading: false}, this.startVideo));
  }

  render() {
    return (
      <div className="Sminem">
        {this.state.loading && <div className="Sminem__loading">Загрузка...</div>}
        {!this.state.loading && <div className="Sminem__video-container">
            <video id="video" style={{display: "flex", justifyContent: "center", padding: "10px"}}  autoPlay muted ref={this.videoRef}/>
          </div>
        }
      </div>
    )
  }
}

export default Sminem;