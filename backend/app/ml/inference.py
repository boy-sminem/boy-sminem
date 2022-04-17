import io

import timm
import torch
import torchvision.transforms as transforms
from PIL import Image

SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

device = torch.device(f"cuda" if torch.cuda.is_available() else "cpu")


class ModelInference():
    def __init__(self, model_name="mobilenetv2_140", path_to_weights="mobilenetv2_140_best.ckpt"):
        self.model = timm.create_model(model_name=model_name, pretrained=False, num_classes=40)
        cp = torch.load(path_to_weights)
        state_dict = cp["state_dict"]
        state_dict = {k.replace("net.", ""): v for k, v in state_dict.items()}
        self.model.load_state_dict(state_dict)

        self.model.to(device)
        self.model.eval()

    def image_inference(self, img):
        inference_transforms = transforms.Compose(
            [
                transforms.Resize(SIZE),
                transforms.ToTensor(),
                transforms.Normalize(MEAN, STD),
            ]
        )

        image = Image.open(io.BytesIO(img))
        image = inference_transforms(image).float()
        image_tensor = image.unsqueeze_(0)
        input = image_tensor.to(device)

        output = self.model(input)

        probs = torch.nn.functional.softmax(output, dim=1).data.cpu().numpy()

        return probs
