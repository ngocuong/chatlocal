"""Offline Z-Image-Turbo Q8 worker with bounded GPU work per block."""
import json, os, sys, secrets
request=json.load(sys.stdin)
os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
import mlx.core as mx
from mflux.models.z_image.model.z_image_transformer.transformer_block import ZImageTransformerBlock
from mflux.models.z_image.model.z_image_transformer.context_block import ZImageContextBlock
for block in (ZImageTransformerBlock,ZImageContextBlock):
    original=block.__call__
    def synchronized(self,*args,_call=original,**kwargs):
        result=_call(self,*args,**kwargs)
        mx.eval(result)
        mx.synchronize()
        return result
    block.__call__=synchronized
from mlx import nn
for linear in (nn.Linear,nn.QuantizedLinear):
    original_linear=linear.__call__
    def bounded_linear(self,x,_call=original_linear):
        mx.eval(x)
        result=_call(self,x)
        mx.eval(result)
        mx.synchronize()
        return result
    linear.__call__=bounded_linear
def q8_linear(self,x):
    mx.eval(x)
    if self.bits!=8:
        return original_qlinear(self,x)
    weight=mx.dequantize(self.weight,self.scales,self.get('biases'),group_size=self.group_size,bits=self.bits,mode=self.mode).astype(x.dtype)
    mx.eval(weight)
    result=x @ weight.T
    if 'bias' in self:result=result+self.bias
    mx.eval(result)
    mx.synchronize()
    return result
original_qlinear=nn.QuantizedLinear.__call__
nn.QuantizedLinear.__call__=q8_linear
from mflux.models.z_image.cli.z_image_turbo_generate import main
sys.argv=['mflux-generate-z-image-turbo','--model',request['modelPath'],'--base-model','z-image-turbo','--prompt',request['prompt'],'--width','1024','--height','1024','--steps',str(request.get('steps',9)),'--seed',str(request.get('seed',secrets.randbelow(2147483647))),'--output',request['output'],'--low-ram','--mlx-cache-limit-gb','0.5','--vae-tiling','--compute-precision','float16']
if request.get('source'):sys.argv+=['--image-path',request['source'],'--image-strength',str(request.get('sourceInfluence',0.75))]
main()
