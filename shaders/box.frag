#version 300 es
precision mediump float;

out vec4 FragColor;

uniform float ambientStrength, specularStrength, diffuseStrength,shininess;

in vec3 Normal;//法向量
in vec3 FragPos;//相机观察的片元位置
in vec2 TexCoord;//纹理坐标
in vec4 FragPosLightSpace;//光源观察的片元位置

uniform vec3 viewPos;//相机位置
uniform vec4 u_lightPosition; //光源位置	
uniform vec3 lightColor;//入射光颜色

uniform sampler2D diffuseTexture;
uniform sampler2D depthTexture;
uniform samplerCube cubeSampler;//盒子纹理采样器


// 阴影计算：使用深度贴图 + PCF（3x3）进行反走样
float shadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir)
{
    // 透视除法 -> 规范化到 [-1,1] -> 再到 [0,1]
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;

    // 若片元在光的裁剪体之外，则不被阴影（例如光方向的远平面外）
    if(projCoords.z > 1.0) {
        return 0.0;
    }

    // 从深度纹理取最近深度
    float closestDepth;
    float currentDepth = projCoords.z;

    // 计算 bias，避免自阴影 acne（基于法线与光方向的夹角）
    float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.0005);

    // PCF（3x3）采样来减少锯齿
    vec2 texelSize = 1.0 / vec2(textureSize(depthTexture, 0));
    float shadow = 0.0;
    int samples = 0;
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            closestDepth = texture(depthTexture, projCoords.xy + offset).r;
            if(currentDepth - bias > closestDepth) {
                shadow += 1.0;
            }
            samples += 1;
        }
    }
    shadow /= float(samples);

    // 返回 [0,1]，1 表示完全在阴影中
    return shadow;
}       

void main()
{
    
    //采样纹理颜色
    vec3 TextureColor = texture(diffuseTexture, TexCoord).xyz;

    //计算光照颜色
 	vec3 norm = normalize(Normal);
	vec3 lightDir;
	if(u_lightPosition.w==1.0) 
        lightDir = normalize(u_lightPosition.xyz - FragPos);
	else lightDir = normalize(u_lightPosition.xyz);
	vec3 viewDir = normalize(viewPos - FragPos);
	vec3 halfDir = normalize(viewDir + lightDir);


    /*TODO2:根据phong shading方法计算ambient,diffuse,specular*/
    // ambient
    vec3 ambient = ambientStrength * lightColor;

    // diffuse
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;

    // specular (Blinn-Phong)
    float spec = 0.0;
    if(diff > 0.0) {
        spec = pow(max(dot(norm, halfDir), 0.0), shininess);
    }
    vec3 specular = specularStrength * spec * lightColor;

    vec3 lightReflectColor = ambient + diffuse + specular;

    // 判定是否阴影，并对各种颜色进行混合
    float shadow = shadowCalculation(FragPosLightSpace, norm, lightDir);

    // 把阴影作用于漫反射和镜面反射，环境光不受阴影影响
    vec3 lit = ambient + (1.0 - shadow) * (diffuse + specular);

    // 最终颜色（将光照和纹理颜色结合）
    vec3 resultColor = lit * TextureColor;

    // ----- 简单雾化 -----
    // 这里实现指数雾（近处保留颜色，远处混入雾色）
    vec3 fogColor = vec3(0.75, 0.8, 0.9); // 天空/雾颜色，可调
    float distance = length(viewPos - FragPos);
    float fogDensity = 0.02; // 控制雾浓度（可调）
    float fogFactor = clamp(exp(-distance * fogDensity), 0.0, 1.0); // 远处趋近于 0
    vec3 finalColor = mix(fogColor, resultColor, fogFactor);

    FragColor = vec4(finalColor, 1.0);
}


