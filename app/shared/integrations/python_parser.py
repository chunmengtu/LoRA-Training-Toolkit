"""
Python代码解析器 - 从用户上传的Python示例代码中自动提取API参数
"""
import ast
import re
from typing import Any, Dict, List, Optional, Tuple


class PythonAPIParser:
    """解析Python示例代码，提取API调用参数"""
    
    def __init__(self, python_code: str):
        self.python_code = python_code
        self.endpoint = ""
        self.required_params: Dict[str, Any] = {}
        self.optional_params: Dict[str, Any] = {}
        self.param_types: Dict[str, str] = {}
        self.enum_values: Dict[str, List[str]] = {}
        
    def parse(self) -> Dict[str, Any]:
        """解析Python代码并返回提取的参数信息"""
        # 提取endpoint
        self.endpoint = self._extract_endpoint()
        
        # 提取payload参数
        payload_dict = self._extract_payload()
        
        # 分析参数类型和约束
        self._analyze_parameters(payload_dict)
        
        # 从注释中提取参数说明
        self._extract_param_docs()
        
        return {
            "endpoint": self.endpoint,
            "required_params": self.required_params,
            "optional_params": self.optional_params,
            "param_types": self.param_types,
            "enum_values": self.enum_values,
        }
    
    def _extract_endpoint(self) -> str:
        """提取API endpoint"""
        # 匹配 url = "..." 或 POST '...'
        patterns = [
            r'url\s*=\s*["\']([^"\']+)["\']',
            r'POST\s+["\']([^"\']+)["\']',
            r'requests\.post\(["\']([^"\']+)["\']',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, self.python_code)
            if match:
                return match.group(1)
        
        return ""
    
    def _extract_payload(self) -> Dict[str, Any]:
        """提取payload字典"""
        # 尝试使用AST解析
        try:
            tree = ast.parse(self.python_code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name) and target.id == "payload":
                            if isinstance(node.value, ast.Dict):
                                return self._parse_dict_node(node.value)
        except SyntaxError:
            pass
        
        # 回退到正则表达式解析
        return self._extract_payload_regex()
    
    def _parse_dict_node(self, dict_node: ast.Dict) -> Dict[str, Any]:
        """解析AST字典节点"""
        result = {}
        for key, value in zip(dict_node.keys, dict_node.values):
            if isinstance(key, ast.Constant):
                key_str = key.value
                result[key_str] = self._parse_value_node(value)
        return result
    
    def _parse_value_node(self, node: ast.AST) -> Any:
        """解析AST值节点"""
        if isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.List):
            return [self._parse_value_node(elt) for elt in node.elts]
        elif isinstance(node, ast.Dict):
            return self._parse_dict_node(node)
        elif isinstance(node, ast.Name):
            return f"<variable:{node.id}>"
        return None
    
    def _extract_payload_regex(self) -> Dict[str, Any]:
        """使用正则表达式提取payload"""
        payload_dict = {}
        
        # 匹配 "key": value 模式（处理可能的引号问题）
        patterns = [
            (r'"imageUrls"\s*:\s*\[([^\]]+)\]', "imageUrls", "list"),
            (r'"prompt"\s*:\s*"([^"]*)"', "prompt", "string"),
            (r'"resolution"\s*:\s*"([^"]*)"', "resolution", "string"),
            (r'"aspectRatio"\s*:\s*"([^"]*)"', "aspectRatio", "string"),
            (r'"width"\s*:\s*(\d+)', "width", "int"),
            (r'"height"\s*:\s*(\d+)', "height", "int"),
            (r'"size"\s*:\s*"([^"]*)"', "size", "string"),
            (r'"quality"\s*:\s*"([^"]*)"', "quality", "string"),
            (r'"inputFidelity"\s*:\s*"([^"]*)"', "inputFidelity", "string"),
            (r'"sequentialImageGeneration"\s*:\s*"([^"]*)"', "sequentialImageGeneration", "string"),
            (r'"maxImages"\s*:\s*(\d+)', "maxImages", "int"),
        ]
        
        for pattern, key, value_type in patterns:
            match = re.search(pattern, self.python_code)
            if match:
                value = match.group(1)
                if value_type == "int":
                    payload_dict[key] = int(value)
                elif value_type == "list":
                    # 清理列表中的引号
                    items = [item.strip().strip('"').strip("'") for item in value.split(',')]
                    payload_dict[key] = [item for item in items if item and not item.startswith('http')]
                else:
                    payload_dict[key] = value
        
        return payload_dict
    
    def _analyze_parameters(self, payload_dict: Dict[str, Any]):
        """分析参数类型和必填/可选"""
        # 基于示例值判断参数类型
        for key, value in payload_dict.items():
            if isinstance(value, list):
                self.param_types[key] = "List[String]"
            elif isinstance(value, int):
                self.param_types[key] = "Int"
            elif isinstance(value, str):
                self.param_types[key] = "String"
            else:
                self.param_types[key] = "Any"
            
            # 默认将有值的参数视为必填
            if value and not str(value).startswith("<variable:"):
                self.required_params[key] = value
    
    def _extract_param_docs(self):
        """从注释中提取参数说明和枚举值"""
        # 查找参数说明表格
        lines = self.python_code.split('\n')
        in_param_table = False
        current_param = None
        
        for line in lines:
            # 检测参数说明表格开始
            if '参数说明' in line and '类型' in line:
                in_param_table = True
                continue
            
            if in_param_table:
                # 提取参数名、类型和必填/可选信息
                param_match = re.search(r'`(\w+)`', line)
                if param_match:
                    current_param = param_match.group(1)
                    
                    # 检测必填/可选
                    if '必填' in line:
                        # 如果在optional_params中，移到required_params
                        if current_param in self.optional_params:
                            self.required_params[current_param] = self.optional_params.pop(current_param)
                        # 如果不在任何地方，添加空值到required
                        elif current_param not in self.required_params:
                            self.required_params[current_param] = ""
                    
                    elif '可选' in line:
                        # 如果在required_params中，移到optional_params
                        if current_param in self.required_params:
                            self.optional_params[current_param] = self.required_params.pop(current_param)
                        # 如果不在任何地方，添加空值到optional
                        elif current_param not in self.optional_params:
                            self.optional_params[current_param] = ""
                
                # 提取枚举值
                enum_match = re.search(r'枚举值:\s*\[([^\]]+)\]', line)
                if enum_match and current_param:
                    enum_str = enum_match.group(1)
                    enum_values = [v.strip() for v in enum_str.split(',')]
                    self.enum_values[current_param] = enum_values
                
                # 表格结束
                if line.strip().startswith('###') or (line.strip().startswith('##') and '参数说明' not in line):
                    in_param_table = False
                    current_param = None


def parse_python_example(python_code: str) -> Dict[str, Any]:
    """
    解析Python示例代码，提取API调用信息
    
    Args:
        python_code: Python示例代码字符串
        
    Returns:
        包含endpoint、参数信息的字典
    """
    parser = PythonAPIParser(python_code)
    return parser.parse()


def build_payload_from_parsed(
    parsed_info: Dict[str, Any],
    user_prompt: str,
    user_images: List[str],
    user_params: Dict[str, Any]
) -> Dict[str, Any]:
    """
    根据解析的信息和用户输入构建API payload
    
    Args:
        parsed_info: 解析的API信息
        user_prompt: 用户提供的prompt
        user_images: 用户提供的图片列表
        user_params: 用户提供的其他参数
        
    Returns:
        构建好的payload字典
    """
    payload = {}
    
    # 始终添加imageUrls（必填）
    payload["imageUrls"] = user_images
    
    # 始终添加prompt（必填）
    payload["prompt"] = user_prompt
    
    # 填充必填参数（除了imageUrls和prompt）
    for key, default_value in parsed_info.get("required_params", {}).items():
        if key in ["imageUrls", "images"]:
            continue  # 已经处理
        elif key == "prompt":
            continue  # 已经处理
        elif key in user_params and user_params[key] not in (None, ""):
            payload[key] = user_params[key]
        elif default_value not in (None, ""):
            payload[key] = default_value
    
    # 填充可选参数
    for key, default_value in parsed_info.get("optional_params", {}).items():
        if key in user_params and user_params[key] not in (None, ""):
            value = user_params[key]
            # 验证枚举值
            if key in parsed_info.get("enum_values", {}):
                allowed = parsed_info["enum_values"][key]
                if value not in allowed:
                    continue
            payload[key] = value
    
    return payload
