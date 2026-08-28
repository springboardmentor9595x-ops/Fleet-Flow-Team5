from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud.user import get_user_by_email
from app.core.security import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception

    return user


def require_roles(*allowed_roles):
    """
    Dependency factory to restrict endpoint access to specific RoleEnum values.
    Raises 403 Forbidden if current_user.role is not in allowed_roles.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            role_names = ", ".join([str(r.value if hasattr(r, 'value') else r) for r in allowed_roles])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of the following roles: {role_names}.",
            )
        return current_user

    return role_checker


from app.models.user import User, RoleEnum

require_admin = require_roles(RoleEnum.Admin)
require_fleet_manager_or_admin = require_roles(RoleEnum.Admin, RoleEnum.FleetManager)
require_management = require_roles(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher)

