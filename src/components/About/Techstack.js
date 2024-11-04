import React from "react";
import { Col, Row } from "react-bootstrap";
import { DiJavascript1, DiReact, DiNodejs, DiMongodb, DiPython, DiGit } from "react-icons/di";
import { SiPytorch, SiFirebase, SiNextdotjs, SiDotnet, SiAmazonaws, SiAzuredevops, SiJenkins, SiDocker, SiKubernetes } from "react-icons/si";

function Techstack() {
  return (
    <Row style={{ justifyContent: "center", paddingBottom: "50px" }}>
      <Col xs={4} md={2} className="tech-icons">
        <SiDotnet /> {/* .NET Core */}
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <DiJavascript1 />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <DiNodejs />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <DiReact />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <DiMongodb />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiNextdotjs />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <DiGit />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiFirebase />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <DiPython />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiPytorch />
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiAmazonaws /> {/* AWS Services */}
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiAzuredevops /> {/* Azure DevOps */}
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiDocker /> {/* Docker */}
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiKubernetes /> {/* Kubernetes */}
      </Col>
      <Col xs={4} md={2} className="tech-icons">
        <SiJenkins /> {/* Jenkins */}
      </Col>
    </Row>
  );
}

export default Techstack;
