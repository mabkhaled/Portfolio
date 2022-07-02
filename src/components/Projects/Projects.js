import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import ProjectCard from "./ProjectCards";
import Particle from "../Particle";
import K1 from "../../Assets/Projects/k1.jpg";
import emotion from "../../Assets/Projects/emotion.png";
import k2 from "../../Assets/Projects/k2.png";
import k4 from "../../Assets/Projects/k4.avif";
import suicide from "../../Assets/Projects/suicide.png";
import k5 from "../../Assets/Projects/k5.png";

function Projects() {
  return (
    <Container fluid className="project-section">
      <Particle />
      <Container>
        <h1 className="project-heading">
          My Recent <strong className="purple">Works </strong>
        </h1>
        <p style={{ color: "white" }}>
          Here are a few projects I've worked on recently.
        </p>
        <Row style={{ justifyContent: "center", paddingBottom: "10px" }}>
          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={K1}
              isBlog={false}
              title="BALADIYATI"
              description="IOS Project Backend of a Mobile application designed for the citizens wich provides them with the informations needed about their neighberhood."
              ghLink="https://github.com/mabkhaled/baladiyati2"
              //demoLink=""
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={k2}
              isBlog={false}
              title="CHATBOT APP GENERATOR"
              description="Telegram chatbot used to generate and create personalized flutter apk app              ."
              ghLink="https://github.com/mabkhaled/botflutter"
              //demoLink=""
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={k5}
              isBlog={false}
              title="Anomaly"
              description="IOS and ANDROID APP gives the users the ability to report a claim to the municipality he is registred to. Search for historical and public locations near the user's location"
              ghLink="https://github.com/mabkhaled/anomaly-backend"
              //demoLink=""              
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={k4}
              isBlog={false}
              title="Learnify"
              description="the process of using technology to assist learning and tutoring.using VusJS for frontend and spring boot for backend and many external API              ."
              ghLink="https://github.com/mabkhaled/Learnify-frontend"
             // demoLink=""
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={suicide}
              isBlog={false}
              title="Ai For Social Good"
              description="Using 'Natural Launguage Processing' for the detection of suicide-related posts and user's suicide ideation in cyberspace  and thus helping in sucide prevention."
              ghLink="https://github.com/mabkhaled/"
              // demoLink="https://www.youtube.com/watch?v=dQw4w9WgXcQ&ab_channel=RickAstley" <--------Please include a demo link here
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={emotion}
              isBlog={false}
              title="Face Recognition and Emotion Detection"
              description="Trained a CNN classifier using 'FER-2013 dataset' with Keras and tensorflow backened. The classifier sucessfully predicted the various types of emotions of human. And the highest accuracy obtained with the model was 60.1%.
              Then used Open-CV to detect the face in an image and then pass the face to the classifer to predict the emotion of a person."
              ghLink="https://github.com/mabkhaled/"
              // demoLink="https://blogs.soumya-jit.tech/"      <--------Please include a demo link here 
            />
          </Col>
        </Row>
      </Container>
    </Container>
  );
}

export default Projects;
